import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { CreditCard, Send, Clock, CheckCircle, XCircle, Package } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";

interface PaymentMethod {
  id: string;
  name: string;
  account_holder_name: string;
  account_number: string;
}

interface PackageItem {
  id: string;
  name: string;
  credits: number;
  price: number;
  currency: string;
}

interface PaymentRequest {
  id: string;
  transaction_number: string;
  amount: number;
  status: string;
  created_at: string;
  payment_method_id: string;
  package_id: string | null;
}

const WalletTopUp = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [requests, setRequests] = useState<PaymentRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Selection state
  const [selectedPackage, setSelectedPackage] = useState<PackageItem | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [transactionNumber, setTransactionNumber] = useState("");
  const [sending, setSending] = useState(false);
  const [step, setStep] = useState<"packages" | "methods">("packages");

  const fetchData = async () => {
    setLoading(true);
    const [{ data: m }, { data: p }, { data: r }] = await Promise.all([
      supabase.from("payment_methods").select("*").order("created_at", { ascending: false }),
      supabase.from("packages").select("*").eq("is_active", true).order("credits", { ascending: true }),
      supabase.from("payment_requests").select("*").order("created_at", { ascending: false }),
    ]);
    if (m) setMethods(m);
    if (p) setPackages(p as PackageItem[]);
    if (r) setRequests(r as PaymentRequest[]);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSelectPackage = (pkg: PackageItem) => {
    setSelectedPackage(pkg);
    setStep("methods");
  };

  const handleBack = () => {
    setStep("packages");
    setSelectedMethod(null);
    setTransactionNumber("");
  };

  const handleSubmit = async () => {
    if (!selectedMethod || !selectedPackage || !transactionNumber.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("payment_requests").insert({
      user_id: user.id,
      payment_method_id: selectedMethod.id,
      package_id: selectedPackage.id,
      transaction_number: transactionNumber.trim(),
      amount: selectedPackage.credits,
    } as any);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Sent", description: "Your payment verification request has been submitted." });
      setSelectedMethod(null);
      setSelectedPackage(null);
      setTransactionNumber("");
      setStep("packages");
      fetchData();
    }
    setSending(false);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "approved":
        return <Badge className="bg-green-600 text-white gap-1"><CheckCircle className="h-3 w-3" />Approved</Badge>;
      case "rejected":
        return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" />Rejected</Badge>;
      default:
        return <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />Pending</Badge>;
    }
  };

  const getMethodName = (id: string) => methods.find(m => m.id === id)?.name || "Unknown";
  const getPackageName = (r: PaymentRequest) => {
    if (r.package_id) {
      const pkg = packages.find(p => p.id === r.package_id);
      return pkg ? `${pkg.credits} PDFs - ${pkg.price} ${pkg.currency}` : `${r.amount} credits`;
    }
    return `${r.amount} credits`;
  };

  if (loading) return null;

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <CreditCard className="h-5 w-5 text-primary" />
            Top Up Wallet
          </CardTitle>
        </CardHeader>
        <CardContent>
          {step === "packages" && (
            <>
              {packages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No packages available yet.</p>
              ) : (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">
                    Choose a package to top up your wallet credits.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {packages.map((pkg) => (
                      <div
                        key={pkg.id}
                        className="flex flex-col items-center justify-between rounded-lg border border-border p-4 hover:border-primary/50 hover:bg-accent/50 transition-colors cursor-pointer"
                        onClick={() => handleSelectPackage(pkg)}
                      >
                        <Package className="h-8 w-8 text-primary mb-2" />
                        <p className="font-semibold text-foreground text-lg">{pkg.credits} PDFs</p>
                        <p className="text-lg font-bold text-primary mt-1">{pkg.price} {pkg.currency}</p>
                        <Button size="sm" className="mt-3 w-full">Select</Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {step === "methods" && selectedPackage && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handleBack}>← Back to packages</Button>
                <Badge variant="outline" className="gap-1">
                  <Package className="h-3 w-3" />
                  {selectedPackage.credits} PDFs — {selectedPackage.price} {selectedPackage.currency}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Transfer <strong>{selectedPackage.price} {selectedPackage.currency}</strong> to one of the accounts below, then click "Verify" to submit your transaction number.
              </p>
              {methods.length === 0 ? (
                <p className="text-sm text-muted-foreground">No payment methods available.</p>
              ) : (
                methods.map((m) => (
                  <div key={m.id} className="flex items-center justify-between rounded-lg border border-border p-4">
                    <div>
                      <p className="font-medium text-foreground">{m.name}</p>
                      <p className="text-sm text-muted-foreground">{m.account_holder_name}</p>
                      <p className="text-sm font-mono text-muted-foreground">{m.account_number}</p>
                    </div>
                    <Button size="sm" onClick={() => setSelectedMethod(m)} className="gap-2">
                      <Send className="h-4 w-4" />
                      Verify
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}

          {requests.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-foreground mb-3">Your Requests</h3>
              <div className="space-y-2">
                {requests.map((r) => (
                  <div key={r.id} className="flex items-center justify-between rounded-md border border-border p-3 text-sm">
                    <div>
                      <p className="font-medium text-foreground">{getPackageName(r)}</p>
                      <p className="text-muted-foreground">Via: {getMethodName(r.payment_method_id)} · TXN: {r.transaction_number}</p>
                      <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                    </div>
                    {getStatusBadge(r.status)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={!!selectedMethod} onOpenChange={(o) => !o && setSelectedMethod(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Payment</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium text-foreground">{selectedPackage?.credits} PDFs — {selectedPackage?.price} {selectedPackage?.currency}</p>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <p className="text-sm font-medium text-foreground">{selectedMethod?.name}</p>
              <p className="text-sm text-muted-foreground">{selectedMethod?.account_holder_name}</p>
              <p className="text-sm font-mono text-muted-foreground">{selectedMethod?.account_number}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Transaction Number</label>
              <Input
                value={transactionNumber}
                onChange={(e) => setTransactionNumber(e.target.value)}
                placeholder="Enter your transaction number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedMethod(null)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={sending || !transactionNumber.trim()}>
              {sending ? "Sending..." : "Submit for Verification"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default WalletTopUp;
