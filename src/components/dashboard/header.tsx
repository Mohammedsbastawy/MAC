"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LifeBuoy, LogOut, Settings, ShieldCheck, User, Loader2, Zap, PanelLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "../ui/sidebar";
import { ThemeToggle } from "../theme-toggle";


const formSchema = z.object({
  email: z.string().email({ message: "Please enter a valid domain email." }),
  password: z.string().min(1, { message: "Password is required." }),
});

const InlineLoginForm: React.FC = () => {
    const { login } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [isLoading, setIsLoading] = React.useState(false);
  
    const form = useForm<z.infer<typeof formSchema>>({
      resolver: zodResolver(formSchema),
      defaultValues: {
        email: "",
        password: "",
      },
    });
  
    async function onSubmit(values: z.infer<typeof formSchema>) {
      setIsLoading(true);
      const { success, error } = await login(values.email, values.password);
      if (success) {
        toast({
          title: "Login Successful",
          description: "Welcome back!",
        });
        router.refresh();
      } else {
        toast({
          variant: "destructive",
          title: "Login Failed",
          description: error || "Please check your credentials and try again.",
        });
      }
      setIsLoading(false);
    }
  
    return (
        <form onSubmit={form.handleSubmit(onSubmit)} className="flex items-center gap-2">
             <Input
                type="email"
                placeholder="Domain Admin Email"
                autoComplete="email"
                className="h-9 w-64"
                {...form.register("email")}
            />
            <Input
                type="password"
                placeholder="Password"
                autoComplete="current-password"
                className="h-9 w-48"
                {...form.register("password")}
            />
            <Button type="submit" className="h-9" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  <span>Signing In...</span>
                </>
              ) : (
                "Sign In"
              )}
            </Button>
        </form>
    )
};


const UserMenu: React.FC = () => {
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = async () => {
        await logout();
        router.refresh();
    }
    
    return (
         <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="relative h-8 w-8 rounded-full">
              <Avatar className="h-9 w-9">
                <AvatarImage src="https://i.pravatar.cc/150?u=admin" alt="Admin" />
                <AvatarFallback>{user?.email.substring(0, 2).toUpperCase() || 'AD'}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{user?.user}</p>
                <p className="text-xs leading-none text-muted-foreground">
                  {user?.email}
                </p>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuItem>
                <User className="mr-2 h-4 w-4" />
                <span>Profile</span>
              </DropdownMenuItem>
              <DropdownMenuItem>
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/dashboard/help')}>
                <LifeBuoy className="mr-2 h-4 w-4" />
                <span>Support</span>
              </DropdownMenuItem>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
    )
}

export default function DashboardHeader() {
  const { user, isLoading } = useAuth();
  const { isMobile, toggleSidebar } = useSidebar();
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
      {isMobile && (
         <Button size="icon" variant="outline" className="sm:hidden" onClick={toggleSidebar}>
            <PanelLeft className="h-5 w-5" />
            <span className="sr-only">Toggle Menu</span>
        </Button>
      )}
      <div className="ml-auto flex items-center gap-4">
        <ThemeToggle />
        {isLoading ? (
            <Loader2 className="animate-spin text-muted-foreground" />
        ) : user ? (
            <>
              <UserMenu />
            </>
        ) : (
            <InlineLoginForm />
        )}
      </div>
    </header>
  );
}
