import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { api, getErrorMessage } from "@/lib/api";
import type { PaymentRequest } from "@/lib/api-types";
import { CheckCircle, XCircle, Clock, Receipt, Undo2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

const PaymentRequests = () => {
  const { toast } = useToast();
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionTarget, setActionTarget] = useState<{ request: PaymentRequest; action: "approve" | "reject" | "reverse" } | null>(null);
  const [processing, setProcessing] = useState(false);

  const fetchData = async () => {
    setLoading(true);
    const { paymentRequests } = await api.getPaymentRequests();
    setRequests(paymentRequests);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async () => {
    if (!actionTarget) return;
    const { request, action } = actionTarget;
    setProcessing(true);

    try {
      await api.actOnPaymentRequest(request.id, action);
      const messages: Record<string, { title: string; description: string }> = {
        approve: { title: "Approved", description: `${request.amount} credits added to user's wallet.` },
        reject: { title: "Rejected", description: "Payment request rejected." },
        reverse: { title: "Reversed", description: `${request.amount} credits deducted from user's wallet.` },
      };
      toast(messages[action]);
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setProcessing(false);
      setActionTarget(null);
      fetchData();
    }
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
                    return (
                      <TableRow key={r.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{r.user_name || "Unknown"}</p>
                            <p className="text-xs text-muted-foreground">{r.user_email || ""}</p>
                          </div>
                        </TableCell>
                        <TableCell>{r.payment_method_name || "Unknown"}</TableCell>
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
