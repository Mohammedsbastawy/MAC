import LoginForm from '@/components/auth/login-form';

export default function Home() {
  return (
    <main className="flex min-h-screen w-full items-center justify-center bg-background p-4">
      <LoginForm />
    </main>
  );
}
