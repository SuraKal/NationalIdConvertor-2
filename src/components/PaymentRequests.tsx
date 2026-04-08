import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, XCircle, Clock, Receipt, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface PaymentRequest {
  id: string;
  user_id: string;
  payment_method_id: string;
  transaction_number: string;
  amount: number;
  status: string;
  created_at: string;
  reviewed_at: string | null;
}

interface Profile {
  user_id: string;
  name: string;
  email: string;
}

const PaymentRequests = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [methods, setMethods] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<{ request: PaymentRequest; action: "approve" | "reject" | "reverse" } | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const [{ data: reqs }, { data: profs }, { data: meths }] = await Promise.all([
      supabase.from("payment_requests").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, name, email"),
      supabase.from("payment_methods").select("id, name"),
    ]);
    if (reqs) setRequests(reqs as PaymentRequest[]);
    if (profs) {
      const map = new Map<string, Profile>();
      profs.forEach((p) => map.set(p.user_id, p));
      setProfiles(map);
    }
    if (meths) {
      const map = new Map<string, string>();
      meths.forEach((m) => map.set(m.id, m.name));
      setMethods(map);
    }
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async () => {
    if (!actionTarget) return;
    const { request, action } = actionTarget;
    setProcessing(true);

    if (action === "approve") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance")
        .eq("user_id", request.user_id)
        .single();

      if (profile) {
        const newBalance = profile.wallet_balance + request.amount;
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ wallet_balance: newBalance })
          .eq("user_id", request.user_id);
        if (updateErr) {
          toast({ title: "Error", description: updateErr.message, variant: "destructive" });
          setProcessing(false);
          return;
        }
      }
    }

    if (action === "reverse") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("wallet_balance")
        .eq("user_id", request.user_id)
        .single();

      if (profile) {
        const newBalance = Math.max(0, profile.wallet_balance - request.amount);
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ wallet_balance: newBalance })
          .eq("user_id", request.user_id);
        if (updateErr) {
          toast({ title: "Error", description: updateErr.message, variant: "destructive" });
          setProcessing(false);
          return;
        }
      }
    }

    const newStatus = action === "approve" ? "approved" : action === "reject" ? "rejected" : "reversed";
    const { error } = await supabase
      .from("payment_requests")
      .update({ status: newStatus, reviewed_at: new Date().toISOString() } as any)
      .eq("id", request.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      const messages: Record<string, { title: string; description: string }> = {
        approve: { title: "Approved", description: `${request.amount} credits added to user's wallet.` },
        reject: { title: "Rejected", description: "Payment request rejected." },
        reverse: { title: "Reversed", description: `${request.amount} credits deducted from user's wallet.` },
      };
      toast(messages[action]);
    }

    setProcessing(false);
    setActionTarget(null);
    fetchData();
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600 text-white gap-1"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      case "reversed":
        return <Badge variant="outline" className="gap-1 text-orange-600 border-orange-600"><Undo2 className="h-3 w-3" />Reversed</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    }
  };

  const pendingCount = requests.filter(r => r.status === "pending").length;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5 text-primary" />
            Payment Requests ({pendingCount} pending)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Payment Method</TableHead>
                  <TableHead>Transaction #</TableHead>
                  <TableHead className="text-center">Credits</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {requests.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground">
                      No payment requests yet
                    </TableCell>
                  </TableRow>
                ) : (
                  requests.map((r) => {
                    const profile = profiles.get(r.user_id);
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{profile?.name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{profile?.email || ""}</p>
                          </div>
                        </TableCell>
                        <TableCell>{methods.get(r.payment_method_id) || "Unknown"}</TableCell>
                        <TableCell className="font-mono text-sm">{r.transaction_number}</TableCell>
                        <TableCell className="text-center">{r.amount}</TableCell>
                        <TableCell className="text-center">{getStatusBadge(r.status)}</TableCell>
                        <TableCell className="text-sm">{new Date(r.created_at).toLocaleDateString()}</TableCell>
                        <TableCell className="text-right">
                        {(r.status === "pending" || r.status === "reversed" || r.status === "rejected") ? (
                            <div className="flex justify-end gap-2">
                              <Button
                                size="sm"
                                variant="outline"
                                className="gap-1 text-green-600 border-green-600 hover:bg-green-50"
                                onClick={() => setActionTarget({ request: r, action: "approve" })}
                              >
                                <CheckCircle className="h-3 w-3" />
                                Approve
                              </Button>
                              {r.status !== "rejected" && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-1"
                                  onClick={() => setActionTarget({ request: r, action: "reject" })}
                                >
                                  <XCircle className="h-3 w-3" />
                                  Reject
                                </Button>
                              )}
                            </div>
                          ) : r.status === "approved" ? (
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1 text-orange-600 border-orange-600 hover:bg-orange-50"
                              onClick={() => setActionTarget({ request: r, action: "reverse" })}
                            >
                              <Undo2 className="h-3 w-3" />
                              Reverse
                            </Button>
                          ) : null}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!actionTarget} onOpenChange={(o) => !o && setActionTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {actionTarget?.action === "approve" ? "Approve" : actionTarget?.action === "reverse" ? "Reverse" : "Reject"} Payment Request
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {actionTarget?.action === "approve"
              ? `This will add ${actionTarget.request.amount} credits to the user's wallet.`
              : actionTarget?.action === "reverse"
              ? `This will deduct ${actionTarget?.request.amount} credits from the user's wallet and mark the request as reversed.`
              : "This will reject the payment request. No credits will be added."}
          </p>
          <p className="text-sm">
            <strong>Transaction:</strong> {actionTarget?.request.transaction_number}
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActionTarget(null)}>Cancel</Button>
            <Button
              variant={actionTarget?.action === "approve" ? "default" : "destructive"}
              onClick={handleAction}
              disabled={processing}
            >
              {processing ? "Processing..." : actionTarget?.action === "approve" ? "Approve" : actionTarget?.action === "reverse" ? "Reverse" : "Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PaymentRequests;
