"use client";

import * as React from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAuth } from "@/hooks/use-auth";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Loader2, ServerCrash, Users, FileText, Laptop, Folder, Shield, MoreHorizontal, UserCog, KeyRound, UserX, UserCheck, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ADComputer, ADUser } from "@/lib/types";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";


type ADError = {
    message: string;
    details?: string;
}

const computerColumns: ColumnDef<ADComputer>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "dns_hostname", header: "DNS Hostname" },
    { accessorKey: "os", header: "Operating System" },
    { accessorKey: "last_logon", header: "Last Logon" },
    { accessorKey: "created", header: "Date Created" },
];

const PlaceholderTab: React.FC<{title: string; icon: React.ElementType}> = ({ title, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg h-96">
        <Icon className="h-12 w-12 mb-4" />
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm">This feature is not yet implemented.</p>
    </div>
)


const ComputerTabContent: React.FC<{computers: ADComputer[]}> = ({computers}) => {
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

     const table = useReactTable({
        data: computers,
        columns: computerColumns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        state: {
        sorting,
        columnFilters,
        },
    });

    return (
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Laptop /> Domain Computers
                        </CardTitle>
                        <CardDescription>
                        A list of all computer objects found in the domain. Found {table.getRowModel().rows.length} computers.
                        </CardDescription>
                    </div>
                    <Input
                        placeholder="Filter computer name..."
                        value={(table.getColumn("name")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("name")?.setFilterValue(event.target.value)
                        }
                        className="max-w-sm"
                        />
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                <TableHead key={header.id} onClick={() => header.column.toggleSorting(header.column.getIsSorted() === "asc")}>
                                    {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                        )}
                                </TableHead>
                                );
                            })}
                            </TableRow>
                        ))}
                        </TableHeader>
                        <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                            >
                                {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                                ))}
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={computerColumns.length} className="h-24 text-center">
                                No results.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}

const UserTabContent: React.FC<{users: ADUser[], onUpdate: () => void}> = ({users, onUpdate}) => {
    const { toast } = useToast();
    const [sorting, setSorting] = React.useState<SortingState>([]);
    const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
    const [passwordDialog, setPasswordDialog] = React.useState<{isOpen: boolean, user: ADUser | null}>({isOpen: false, user: null});
    const [isPasswordChangeLoading, setIsPasswordChangeLoading] = React.useState(false);

    const handleSetPassword = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!passwordDialog.user) return;

        const formData = new FormData(event.currentTarget);
        const new_password = formData.get('new_password') as string;

        if (!new_password) {
            toast({ variant: "destructive", title: "Password cannot be empty." });
            return;
        }

        setIsPasswordChangeLoading(true);
        try {
            const res = await fetch("/api/ad/set-user-password", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: passwordDialog.user.username, new_password })
            });
            const data = await res.json();
            if (data.ok) {
                toast({ title: "Success", description: data.message });
                setPasswordDialog({isOpen: false, user: null});
            } else {
                 toast({ variant: "destructive", title: data.error || "Failed", description: data.message });
            }
        } catch (error) {
            toast({ variant: "destructive", title: "Client Error", description: "Failed to send request to the server." });
        } finally {
            setIsPasswordChangeLoading(false);
        }
    }
    
    const handleSetUserStatus = async (username: string, enable: boolean) => {
        const action = enable ? "enable" : "disable";
        toast({ title: "Processing...", description: `Attempting to ${action} user ${username}.` });
        try {
             const res = await fetch("/api/ad/set-user-status", {
                method: "POST",
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username, action })
            });
            const data = await res.json();
             if (data.ok) {
                toast({ title: "Success", description: data.message });
                onUpdate(); // Refresh the user list
            } else {
                 toast({ variant: "destructive", title: data.error || "Failed", description: data.message });
            }
        } catch (error) {
             toast({ variant: "destructive", title: "Client Error", description: "Failed to send request to the server." });
        }
    }


    const userColumns: ColumnDef<ADUser>[] = [
        { 
            accessorKey: "username", 
            header: "Username" ,
            cell: ({row}) => (
                <div className="flex flex-col">
                    <span className="font-medium">{row.original.username}</span>
                    <span className="text-xs text-muted-foreground">{row.original.email}</span>
                </div>
            )
        },
        { accessorKey: "display_name", header: "Display Name" },
        { 
            accessorKey: "enabled", 
            header: "Status",
            cell: ({ row }) => (
                <Badge variant={row.original.enabled ? "default" : "destructive"} className={row.original.enabled ? "bg-green-600" : ""}>
                    {row.original.enabled ? 
                        <CheckCircle2 className="mr-1 h-3 w-3" /> :
                        <XCircle className="mr-1 h-3 w-3" />
                    }
                    {row.original.enabled ? "Enabled" : "Disabled"}
                </Badge>
            )
        },
        { accessorKey: "created", header: "Date Created" },
        {
            id: "actions",
            cell: ({ row }) => {
                const user = row.original;
                return (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                                <span className="sr-only">Open menu</span>
                                <MoreHorizontal className="h-4 w-4" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                            <DropdownMenuLabel>Actions</DropdownMenuLabel>
                            <DropdownMenuItem onClick={() => setPasswordDialog({isOpen: true, user})}>
                                <KeyRound className="mr-2 h-4 w-4" />
                                <span>Change Password</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {user.enabled ? (
                                <DropdownMenuItem className="text-destructive" onClick={() => handleSetUserStatus(user.username, false)}>
                                    <UserX className="mr-2 h-4 w-4" />
                                    <span>Disable Account</span>
                                </DropdownMenuItem>
                            ) : (
                                <DropdownMenuItem onClick={() => handleSetUserStatus(user.username, true)}>
                                    <UserCheck className="mr-2 h-4 w-4" />
                                    <span>Enable Account</span>
                                </DropdownMenuItem>
                            )}
                        </DropdownMenuContent>
                    </DropdownMenu>
                )
            }
        }
    ];

    const table = useReactTable({
        data: users,
        columns: userColumns,
        getCoreRowModel: getCoreRowModel(),
        getPaginationRowModel: getPaginationRowModel(),
        onSortingChange: setSorting,
        getSortedRowModel: getSortedRowModel(),
        onColumnFiltersChange: setColumnFilters,
        getFilteredRowModel: getFilteredRowModel(),
        initialState: {
            pagination: { pageSize: 10 }
        },
        state: {
            sorting,
            columnFilters,
        },
    });

     return (
        <>
        <Card>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Users /> Domain Users
                        </CardTitle>
                        <CardDescription>
                        A list of all user objects found in the domain. Found {table.getRowModel().rows.length} users.
                        </CardDescription>
                    </div>
                    <Input
                        placeholder="Filter display name..."
                        value={(table.getColumn("display_name")?.getFilterValue() as string) ?? ""}
                        onChange={(event) =>
                            table.getColumn("display_name")?.setFilterValue(event.target.value)
                        }
                        className="max-w-sm"
                        />
                </div>
            </CardHeader>
            <CardContent>
                <div className="rounded-md border">
                    <Table>
                        <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                <TableHead key={header.id} onClick={() => header.column.toggleSorting(header.column.getIsSorted() === "asc")}>
                                    {header.isPlaceholder
                                    ? null
                                    : flexRender(
                                        header.column.columnDef.header,
                                        header.getContext()
                                        )}
                                </TableHead>
                                );
                            })}
                            </TableRow>
                        ))}
                        </TableHeader>
                        <TableBody>
                        {table.getRowModel().rows?.length ? (
                            table.getRowModel().rows.map((row) => (
                            <TableRow
                                key={row.id}
                                data-state={row.getIsSelected() && "selected"}
                            >
                                {row.getVisibleCells().map((cell) => (
                                <TableCell key={cell.id}>
                                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                </TableCell>
                                ))}
                            </TableRow>
                            ))
                        ) : (
                            <TableRow>
                            <TableCell colSpan={userColumns.length} className="h-24 text-center">
                                No results.
                            </TableCell>
                            </TableRow>
                        )}
                        </TableBody>
                    </Table>
                </div>
                <div className="flex items-center justify-end space-x-2 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.previousPage()}
                        disabled={!table.getCanPreviousPage()}
                    >
                        Previous
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => table.nextPage()}
                        disabled={!table.getCanNextPage()}
                    >
                        Next
                    </Button>
                </div>
            </CardContent>
        </Card>

        <AlertDialog open={passwordDialog.isOpen} onOpenChange={(open) => !open && setPasswordDialog({isOpen: false, user: null})}>
            <form onSubmit={handleSetPassword}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Change Password for {passwordDialog.user?.username}</AlertDialogTitle>
                    <AlertDialogDescription>
                       Enter the new password for the user. This action cannot be undone. The user may be required to change this password at next logon.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="grid gap-2 py-4">
                    <Label htmlFor="new_password">New Password</Label>
                    <Input id="new_password" name="new_password" type="password" required />
                </div>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction type="submit" disabled={isPasswordChangeLoading}>
                        {isPasswordChangeLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Change Password
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
            </form>
        </AlertDialog>
        </>
    );
}

export default function ActiveDirectoryPage() {
  const { user } = useAuth();
  const [computers, setComputers] = React.useState<ADComputer[]>([]);
  const [users, setUsers] = React.useState<ADUser[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<ADError | null>(null);
  const [showErrorDetails, setShowErrorDetails] = React.useState(false);
  const [key, setKey] = React.useState(0); // Used to force re-fetch

  const fetchData = async () => {
    if (!user) {
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const [computersRes, usersRes] = await Promise.all([
        fetch("/api/ad/get-computers", { method: "POST" }),
        fetch("/api/ad/get-users", { method: "POST" }),
      ]);

      const computersData = await computersRes.json();
      const usersData = await usersRes.json();

      if (computersData.ok) {
        setComputers(computersData.computers);
      } else {
        throw computersData; // Throw the error object to be caught below
      }
      
      if (usersData.ok) {
        setUsers(usersData.users);
      } else {
        throw usersData; // Throw the error object
      }

    } catch (err: any) {
      setError({
        message: err.message || "Failed to fetch data from Active Directory.",
        details: err.details || (err instanceof Error ? err.message : "The server is likely offline or unreachable.")
      });
    } finally {
      setIsLoading(false);
    }
  };

  React.useEffect(() => {
    fetchData();
  }, [user, key]);


  if (!user) {
      return (
         <div className="flex items-center justify-center h-full">
            <Alert variant="destructive" className="max-w-lg">
                <ServerCrash className="h-4 w-4" />
                <AlertTitle>Authentication Required</AlertTitle>
                <AlertDescription>
                 Please sign in to view Active Directory information.
                </AlertDescription>
            </Alert>
         </div>
      )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="ml-2">Loading Active Directory Objects...</p>
      </div>
    );
  }

  if (error) {
    return (
       <>
        <div className="flex items-center justify-center h-full">
            <Alert variant="destructive" className="max-w-lg">
                <ServerCrash className="h-4 w-4" />
                <AlertTitle>Active Directory Error</AlertTitle>
                <AlertDescription>
                    {error.message}
                </AlertDescription>
                 {error.details && (
                    <Button variant="secondary" size="sm" className="mt-4" onClick={() => setShowErrorDetails(true)}>
                        <FileText className="mr-2 h-4 w-4" />
                        View Details
                    </Button>
                )}
            </Alert>
        </div>
        <AlertDialog open={showErrorDetails} onOpenChange={setShowErrorDetails}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Error Details</AlertDialogTitle>
                     <AlertDialogDescription>
                        The following technical details were returned from the server. This can help diagnose the issue.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <Textarea
                    readOnly
                    value={error.details}
                    className="h-64 text-xs font-mono bg-muted"
                />
                <AlertDialogFooter>
                    <AlertDialogAction onClick={() => setShowErrorDetails(false)}>Close</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
       </>
    );
  }

  return (
    <div className="space-y-6">
        <div className="flex flex-col items-start gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
            <h1 className="text-2xl font-headline font-bold tracking-tight md:text-3xl">Active Directory Management</h1>
            <p className="text-muted-foreground">
                Browse and manage AD objects like computers, users, and groups.
            </p>
            </div>
             <Button onClick={() => setKey(prev => prev + 1)}>
                <Loader2 className="mr-2 h-4 w-4 animate-spin data-[hidden]:hidden" hidden={!isLoading} />
                Refresh Data
            </Button>
        </div>

        <Tabs defaultValue="computers">
            <TabsList>
                <TabsTrigger value="computers">
                    <Laptop className="mr-2 h-4 w-4" />
                    Computers ({computers.length})
                </TabsTrigger>
                 <TabsTrigger value="users">
                    <Users className="mr-2 h-4 w-4" />
                    Users ({users.length})
                </TabsTrigger>
                 <TabsTrigger value="groups">
                    <Shield className="mr-2 h-4 w-4" />
                    Groups
                </TabsTrigger>
                 <TabsTrigger value="ous">
                    <Folder className="mr-2 h-4 w-4" />
                    OUs
                </TabsTrigger>
            </TabsList>
            <TabsContent value="computers" className="mt-4">
                 <ComputerTabContent computers={computers} />
            </TabsContent>
            <TabsContent value="users" className="mt-4">
                <UserTabContent users={users} onUpdate={() => setKey(prev => prev + 1)} />
            </TabsContent>
            <TabsContent value="groups" className="mt-4">
                 <PlaceholderTab title="Groups Management" icon={Shield} />
            </TabsContent>
            <TabsContent value="ous" className="mt-4">
                 <PlaceholderTab title="Organizational Units" icon={Folder} />
            </TabsContent>
        </Tabs>
    </div>
  );
}
