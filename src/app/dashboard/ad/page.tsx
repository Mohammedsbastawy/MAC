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
import { Loader2, ServerCrash, Users, FileText, Laptop, Folder, Shield } from "lucide-react";
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
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { ADComputer } from "@/lib/types";


type ADError = {
    message: string;
    details?: string;
}

const columns: ColumnDef<ADComputer>[] = [
    { accessorKey: "name", header: "Name" },
    { accessorKey: "dns_hostname", header: "DNS Hostname" },
    { accessorKey: "os", header: "Operating System" },
    { accessorKey: "last_logon", header: "Last Logon" },
    { accessorKey: "created", header: "Date Created" },
];


const ComputerTabContent: React.FC<{computers: ADComputer[], table: ReturnType<typeof useReactTable<ADComputer>>}> = ({computers, table}) => (
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
                    <TableCell colSpan={columns.length} className="h-24 text-center">
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

const PlaceholderTab: React.FC<{title: string; icon: React.ElementType}> = ({ title, icon: Icon }) => (
    <div className="flex flex-col items-center justify-center text-center text-muted-foreground p-10 border-2 border-dashed rounded-lg h-96">
        <Icon className="h-12 w-12 mb-4" />
        <h3 className="text-lg font-semibold">{title}</h3>
        <p className="text-sm">This feature is not yet implemented.</p>
    </div>
)


export default function ActiveDirectoryPage() {
  const { user } = useAuth();
  const [computers, setComputers] = React.useState<ADComputer[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<ADError | null>(null);
  const [showErrorDetails, setShowErrorDetails] = React.useState(false);
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);

  React.useEffect(() => {
    const fetchComputers = async () => {
      if (!user) {
        setIsLoading(false);
        return;
      }
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/ad/get-computers", {
          method: "POST",
        });
        const data = await response.json();
        if (data.ok) {
          setComputers(data.computers);
        } else {
          setError({
            message: data.message || "Failed to fetch computers from Active Directory.",
            details: data.details || "No further details were provided by the server."
          });
        }
      } catch (err) {
        setError({
            message: "An unexpected error occurred while contacting the server.",
            details: (err instanceof Error) ? err.message : "The server is likely offline or unreachable."
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchComputers();
  }, [user]);

  const table = useReactTable({
    data: computers,
    columns,
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
        </div>

        <Tabs defaultValue="computers">
            <TabsList>
                <TabsTrigger value="computers">
                    <Laptop className="mr-2 h-4 w-4" />
                    Computers
                </TabsTrigger>
                 <TabsTrigger value="users">
                    <Users className="mr-2 h-4 w-4" />
                    Users
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
                 <ComputerTabContent computers={computers} table={table} />
            </TabsContent>
            <TabsContent value="users" className="mt-4">
                <PlaceholderTab title="Users Management" icon={Users} />
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
