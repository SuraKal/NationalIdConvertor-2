import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { Pencil, Trash2, Shield, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface UserProfile {
  id: string;
  user_id: string;
  name: string;
  email: string;
  wallet_balance: number;
  total_downloads: number;
  created_at: string;
}

interface AdminUsersProps {
  users: UserProfile[];
  type: "admin" | "regular";
  onRefresh: () => void;
}

const AdminUsers = ({ users, type, onRefresh }: AdminUsersProps) => {
  const { toast } = useToast();
  const [editUser, setEditUser] = useState<UserProfile | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editWallet, setEditWallet] = useState(0);
  const [deleteUser, setDeleteUser] = useState<UserProfile | null>(null);

  const isRegular = type === "regular";

  const openEdit = (u: UserProfile) => {
    setEditUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditWallet(u.wallet_balance);
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    const updates: any = { name: editName, email: editEmail };
    if (isRegular) updates.wallet_balance = editWallet;
    const { error } = await supabase.from("profiles").update(updates).eq("id", editUser.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Updated", description: "User profile updated." });
      setEditUser(null);
      onRefresh();
    }
  };

  const handleDelete = async () => {
    if (!deleteUser) return;
    const { error } = await supabase.from("profiles").delete().eq("id", deleteUser.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Deleted", description: "User profile removed." });
      setDeleteUser(null);
      onRefresh();
    }
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isRegular ? <Users className="h-5 w-5 text-primary" /> : <Shield className="h-5 w-5 text-primary" />}
            {isRegular ? `Regular Users (${users.length})` : `Admins (${users.length})`}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                {isRegular && <TableHead className="text-center">Wallet</TableHead>}
                <TableHead className="text-center">Downloads</TableHead>
                <TableHead className="text-center">Joined</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={isRegular ? 6 : 5} className="text-center text-muted-foreground">
                    No users found
                  </TableCell>
                </TableRow>
              ) : (
                users.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell className="font-medium">{u.name}</TableCell>
                    <TableCell>{u.email}</TableCell>
                    {isRegular && <TableCell className="text-center">{u.wallet_balance}</TableCell>}
                    <TableCell className="text-center">{u.total_downloads}</TableCell>
                    <TableCell className="text-center">{new Date(u.created_at).toLocaleDateString()}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(u)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteUser(u)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Edit User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
            </div>
            {isRegular && (
              <div>
                <label className="text-sm font-medium text-foreground">Wallet Balance</label>
                <Input type="number" value={editWallet} onChange={(e) => setEditWallet(Number(e.target.value))} />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button onClick={handleUpdate}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteUser} onOpenChange={(o) => !o && setDeleteUser(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Delete User</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <strong>{deleteUser?.name}</strong>? This action cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteUser(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};




export default AdminUsers;
