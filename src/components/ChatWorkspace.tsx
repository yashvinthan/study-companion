'use client';

import { useRouter } from 'next/navigation';
import ChatInterface from '@/components/ChatInterface';

interface ChatWorkspaceProps {
  studentId: string;
}

export default function ChatWorkspace({ studentId }: ChatWorkspaceProps) {
  const router = useRouter();

  return <ChatInterface studentId={studentId} onConversationSettled={() => router.refresh()} />;
}
