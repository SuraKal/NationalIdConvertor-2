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
import type { PackageItem } from "@/lib/api-types";
import { useToast } from "@/hooks/use-toast";
import { Package, Pencil, Trash2, Plus } from "lucide-react";
import { Switch } from "@/components/ui/switch";

const PackageManagement = () => {
  const { toast } = useToast();
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialog, setShowDialog] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [credits, setCredits] = useState(10);
  const [price, setPrice] = useState(200);
  const [currency, setCurrency] = useState("ETB");
  const [isActive, setIsActive] = useState(true);
  const [deleteItem, setDeleteItem] = useState<PackageItem | null>(null);

  const fetchPackages = async () => {
    setLoading(true);
    const { packages } = await api.getPackages();
    setPackages(packages);
    setLoading(false);
  };

  useEffect(() => { fetchPackages(); }, []);

  const resetForm = () => {
    setEditId(null);
    setCredits(10);
    setPrice(200);
    setCurrency("ETB");
    setIsActive(true);
  };

  const openCreate = () => {
    resetForm();
    setShowDialog(true);
  };

  const openEdit = (p: PackageItem) => {
    setEditId(p.id);
    setCredits(p.credits);
    setPrice(p.price);
    setCurrency(p.currency);
    setIsActive(p.is_active);
    setShowDialog(true);
  };

  const handleSave = async () => {
    const name = `${credits} PDFs - ${price} ${currency}`;
    const payload = { name, credits, price, currency, is_active: isActive };
    try {
      if (editId) {
        await api.updatePackage(editId, payload);
      } else {
        await api.createPackage(payload);
      }
      toast({ title: editId ? "Updated" : "Created", description: `Package ${editId ? "updated" : "created"}.` });
      setShowDialog(false);
      resetForm();
      fetchPackages();
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  const handleDelete = async () => {
    if (!deleteItem) return;
    try {
      await api.deletePackage(deleteItem.id);
      toast({ title: "Deleted", description: "Package removed." });
      setDeleteItem(null);
      fetchPackages();
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            Packages
          </CardTitle>
          <Button size="sm" onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" /> Add Package
          </Button>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Loading...</p>
          ) : (
            <Table>
              <TableHeader>
                 <TableRow>
                   <TableHead className="text-center">Credits</TableHead>
                  <TableHead className="text-center">Price</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {packages.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">No packages</TableCell>
                  </TableRow>
                ) : (
                  packages.map((p) => (
                     <TableRow key={p.id}>
                       <TableCell className="text-center">{p.credits} PDFs</TableCell>
                      <TableCell className="text-center">{p.price} {p.currency}</TableCell>
                      <TableCell className="text-center">
                        <span className={`text-xs font-medium ${p.is_active ? "text-green-600" : "text-muted-foreground"}`}>
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteItem(p)}>
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

      <Dialog open={showDialog} onOpenChange={(o) => { if (!o) { setShowDialog(false); resetForm(); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editId ? "Edit" : "Add"} Package</DialogTitle>
          </DialogHeader>
           <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Credits (PDFs)</label>
              <Input type="number" min={1} value={credits} onChange={(e) => setCredits(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Price</label>
              <Input type="number" min={0} value={price} onChange={(e) => setPrice(Number(e.target.value))} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Currency</label>
              <Input value={currency} onChange={(e) => setCurrency(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <label className="text-sm font-medium text-foreground">Active</label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowDialog(false); resetForm(); }}>Cancel</Button>
            <Button onClick={handleSave}>{editId ? "Update" : "Create"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteItem} onOpenChange={(o) => !o && setDeleteItem(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Package</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteItem?.name}</strong>?
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteItem(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PackageManagement;
