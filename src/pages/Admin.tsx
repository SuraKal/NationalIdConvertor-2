import { useEffect, useState } from "react";
import { useNavigate, Routes, Route } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { api, getErrorMessage } from "@/lib/api";
import type { AuthUser } from "@/lib/api-types";
import { Users, Wallet, Download, UserPlus, ArrowLeft } from "lucide-react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/admin/AdminSidebar";
import AdminUsersComponent from "@/components/admin/AdminUsers";
import PaymentMethods from "@/components/PaymentMethods";
import PaymentRequests from "@/components/PaymentRequests";
import PackageManagement from "@/components/PackageManagement";
import { useToast } from "@/hooks/use-toast";

const Admin = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!loading && !user) { navigate("/login"); return; }
    if (user) checkAdmin();
  }, [user, loading]);

  const checkAdmin = async () => {
    if (user?.role !== "admin") { navigate("/dashboard"); return; }
    setIsAdmin(true);
    fetchUsers();
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    const { users } = await api.getUsers();
    setUsers(users);
    setLoadingUsers(false);
  };

  const handleCreateUser = async () => {
    if (!newName || !newEmail || !newPassword) {
      toast({ title: "Error", description: "All fields are required.", variant: "destructive" });
      return;
    }
    setCreating(true);
    try {
      await api.createUser({
        name: newName,
        email: newEmail,
        password: newPassword,
        role: newRole,
      });
      toast({ title: "Created", description: `${newRole === "admin" ? "Admin" : "User"} created successfully.` });
      setShowCreate(false);
      setNewName(""); setNewEmail(""); setNewPassword(""); setNewRole("user");
      fetchUsers();
    } catch (error) {
      toast({ title: "Error", description: getErrorMessage(error), variant: "destructive" });
    } finally { setCreating(false); }
  };

  if (loading || isAdmin === null) return null;

  const adminUsers = users.filter((u) => u.role === "admin");
  const regularUsers = users.filter((u) => u.role !== "admin");
  const totalCredits = users.reduce((s, u) => s + u.wallet_balance, 0);
  const totalDl = users.reduce((s, u) => s + u.total_downloads, 0);

  const DashboardHome = () => (
    <div className="space-y-6">
      <div className="grid gap-6 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <span className="text-3xl font-bold text-foreground">{users.length}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Credits</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Wallet className="h-8 w-8 text-primary" />
              <span className="text-3xl font-bold text-foreground">{totalCredits}</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Downloads</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Download className="h-8 w-8 text-primary" />
              <span className="text-3xl font-bold text-foreground">{totalDl}</span>
            </div>
          </CardContent>
        </Card>
      </div>
      <PaymentRequests />
    </div>
  );

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AdminSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border bg-card px-4 gap-3">
            <SidebarTrigger />
            <h1 className="text-lg font-bold text-foreground">Admin Panel</h1>
            <div className="ml-auto flex items-center gap-2">
              <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
                <UserPlus className="h-4 w-4" /> Create User
              </Button>
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
                <ArrowLeft className="h-4 w-4" /> Back
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 overflow-auto">
            <Routes>
              <Route index element={<DashboardHome />} />
              <Route path="admins" element={
                loadingUsers ? <p className="text-muted-foreground">Loading...</p> :
                <AdminUsersComponent users={adminUsers} type="admin" onRefresh={fetchUsers} />
              } />
              <Route path="users" element={
                loadingUsers ? <p className="text-muted-foreground">Loading...</p> :
                <AdminUsersComponent users={regularUsers} type="regular" onRefresh={fetchUsers} />
              } />
              <Route path="payment-requests" element={<PaymentRequests />} />
              <Route path="packages" element={<PackageManagement />} />
              <Route path="payment-methods" element={<PaymentMethods />} />
            </Routes>
          </main>
        </div>
      </div>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader><DialogTitle>Create New User</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium text-foreground">Name</label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Full name" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Email</label>
              <Input value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@example.com" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Password</label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Min 6 characters" />
            </div>
            <div>
              <label className="text-sm font-medium text-foreground">Role</label>
              <Select value={newRole} onValueChange={(v: "user" | "admin") => setNewRole(v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">Regular User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={creating}>
              {creating ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarProvider>
  );
};

export default Admin;
