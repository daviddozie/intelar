import ChatApp from "@/components/chat-app";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Exam Prep");

export default function ExamPrepPage() {
    return <ChatApp initialView="exam-prep" />;
}
