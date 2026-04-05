import { SignUp } from '@clerk/nextjs';

export default function Page(): JSX.Element {
  return (
    <main className="min-h-screen flex items-center justify-center bg-gray-50">
      <SignUp />
    </main>
  );
}
