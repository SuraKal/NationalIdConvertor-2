import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { api, getErrorMessage } from "@/lib/api";
import type { PaymentMethod } from "@/lib/api-types";
import { CreditCard, Pencil, Trash2, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const PaymentMethods = () => {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [holderName, setHolderName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<PaymentMethod | null>(null);

  const fetchMethods = async () => {
    setLoading(true);
    const { paymentMethods } = await api.getPaymentMethods();
    setMethods(paymentMethods);
    setLoading(false);
  };

  useEffect(() => { fetchMethods(); }, []);

  const openCreate = () => {
    setEditId(null);
    setName("");
    setHolderName("");
    setAccountNumber("");
    setShowForm(true);
  };

  const openEdit = (m: PaymentMethod) => {
    setEditId(m.id);
    setName(m.name);
    setHolderName(m.account_holder_name);
    setAccountNumber(m.account_number);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!name || !holderName || !accountNumber) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    const payload = { name, account_holder_name: holderName, account_number: accountNumber };

    try {
      if (editId) {
        await api.updatePaymentMethod(editId, payload);
        toast({ title: "Updated", description: "Payment method updated." });
      } else {
        await api.createPaymentMethod(payload);
        toast({ title: "Created", description: "Payment method added." });
      }
      setShowForm(false);
      fetchMethods();
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await api.deletePaymentMethod(deleteTarget.id);
      toast({ title: "Deleted", description: "Payment method removed." });
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
    setDeleteTarget(null);
    fetchMethods();
  };

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              Payment Methods ({methods.length})
            </CardTitle>
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Method
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-muted-foreground text-sm">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Account Holder</TableHead>
                  <TableHead>Account Number</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {methods.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      No payment methods configured
                    </TableCell>
                  </TableRow>
                ) : (
                  methods.map((m) => (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.name}</TableCell>
                      <TableCell>{m.account_holder_name}</TableCell>
                      <TableCell>{m.account_number}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(m)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteTarget(m)}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit" : "Add"} Payment Method</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Commercial Bank of Ethiopia" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Account Holder Name</label>
              <Input value={holderName} onChange={(e) => setHolderName(e.target.value)} placeholder="Full name on the account" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Account Number</label>
              <Input value={accountNumber} onChange={(e) => setAccountNumber(e.target.value)} placeholder="Account number" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving..." : editId ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Payment Method</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteTarget?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PaymentMethods;
