'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Send, Loader2, ArrowLeft, MessageSquare, Bot, User, Sparkles, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import axios from 'axios';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

interface GuestInfo {
  guestName: string;
  roomNumber: string;
}

export default function GuestChatPage() {
  const params = useParams();
  const roomNumber = params?.roomNumber as string;
  const searchParams = useSearchParams();
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [guestName, setGuestName] = useState(`Guest-${roomNumber}`);
  const [showGuestForm, setShowGuestForm] = useState(false);
  const [ticketCreated, setTicketCreated] = useState(false);
  const [showTicketDialog, setShowTicketDialog] = useState(false);
  const [pendingTicketMessage, setPendingTicketMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050/api';

  useEffect(() => {
    // Initialize with welcome message (no guest name required)
    setMessages([{
      role: 'assistant',
      content: `Hi! I'm Ella, your chatbot assistant. What do you need?`,
      timestamp: new Date().toISOString()
    }]);
  }, [roomNumber, searchParams]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleGuestFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guestName.trim()) {
      toast.error('Please enter your name');
      return;
    }
    setShowGuestForm(false);
    // Add welcome message
    setMessages([{
      role: 'assistant',
      content: `Hello ${guestName}! I'm your AI assistant for Room ${roomNumber}. How can I help you today? I can assist with room service, housekeeping, maintenance issues, or any other hotel services.`,
      timestamp: new Date().toISOString()
    }]);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || isSubmitting) return;

    const userMessage: Message = {
      role: 'user',
      content: message,
      timestamp: new Date().toISOString()
    };

    const currentMessage = message;
    setMessages(prev => [...prev, userMessage]);
    setMessage('');
    setIsSubmitting(true);

    try {
      // Automatically create ticket for every user message
      const ticketPromise = axios.post(`${API_BASE_URL}/tickets/guest`, {
        roomNumber: roomNumber,
        guestInfo: {
          name: `Guest-${roomNumber}`,
          email: `guest.${roomNumber}@hotel.com`,
          phone: 'Not provided'
        },
        initialMessage: currentMessage,
        priority: 'medium'
      });

      // Call AI chat API with instruction for varied short responses
      const aiPromise = axios.post(`${API_BASE_URL}/chat/ai`, {
        message: `You are Ella, a friendly hotel chatbot assistant. Respond in maximum 8-10 words with varied, natural language. Be helpful, conversational, and show personality. Avoid repetitive responses. Current request: ${currentMessage}`,
        guestInfo: {
          guestName: `Guest-${roomNumber}`,
          roomNumber: roomNumber
        },
        conversationHistory: messages
      });

      // Wait for both requests
      const [ticketResponse, aiResponse] = await Promise.all([ticketPromise, aiPromise]);

      // Show ticket creation success
      if (ticketResponse.data.success) {
        toast.success(`🎫 Request sent to staff (ID: #${ticketResponse.data.data._id.slice(-6)})`);
      }

      const aiMessage: Message = {
        role: 'assistant',
        content: aiResponse.data.message,
        timestamp: new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);

    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message. Please try again.');
      // Remove the user message if API call failed
      setMessages(prev => prev.slice(0, -1));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile-first responsive container */}
      <div className="w-full max-w-7xl mx-auto px-2 sm:px-4 md:px-6 lg:px-8 pb-safe">
        
        {/* Header Section - Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 sm:mb-6 pt-2 sm:pt-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => router.push('/')}
              className="h-10 w-10 sm:h-12 sm:w-12 touch-manipulation"
            >
              <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6" />
            </Button>
            <div className="flex items-center gap-2">
              <MessageSquare className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold">
                Room {roomNumber} - Ella AI
              </h1>
            </div>
          </div>
          {ticketCreated && (
            <Badge variant="secondary" className="bg-green-100 text-green-800 hover:bg-green-100 text-xs sm:text-sm">
              ✅ Service Request Created
            </Badge>
          )}
        </div>

        {/* Guest Form - Responsive */}
        {showGuestForm ? (
          <Card className="max-w-sm sm:max-w-md mx-auto">
            <CardHeader className="text-center pb-2 px-4 sm:px-6">
              <div className="flex items-center justify-center mb-3 sm:mb-4">
                <Avatar className="h-12 w-12 sm:h-16 sm:w-16">
                  <AvatarFallback className="bg-primary/10">
                    <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
                  </AvatarFallback>
                </Avatar>
              </div>
              <CardTitle className="text-lg sm:text-xl">Welcome to Room {roomNumber}</CardTitle>
              <p className="text-muted-foreground text-xs sm:text-sm">
                Chat with Ella, your AI chatbot for instant help
              </p>
            </CardHeader>
            <div className="border-b" />
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <form onSubmit={handleGuestFormSubmit} className="space-y-3 sm:space-y-4">
                <div className="space-y-2">
                  <label htmlFor="guestName" className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                    Your Name
                  </label>
                  <Input
                    id="guestName"
                    type="text"
                    placeholder="Enter your name"
                    value={guestName}
                    onChange={(e) => setGuestName(e.target.value)}
                    required
                    className="h-9 sm:h-10 text-sm sm:text-base"
                  />
                </div>
                <Button type="submit" className="w-full h-11 sm:h-12 text-sm sm:text-base touch-manipulation">
                    Start Chat with Ella
                  </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          /* Chat Interface - Responsive */
          <Card className="h-[calc(100vh-14rem)] sm:h-[calc(100vh-16rem)] md:h-[calc(100vh-18rem)] lg:h-[calc(100vh-20rem)] flex flex-col">
            <CardHeader className="pb-2 sm:pb-3 px-3 sm:px-4 md:px-6">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10">
                    <AvatarFallback className="bg-primary/10">
                      <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <CardTitle className="text-base sm:text-lg">Ella - AI Chatbot</CardTitle>
                    <p className="text-xs sm:text-sm text-muted-foreground">
                      Room {roomNumber} • Live Support
                    </p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-2">
                  <Badge variant="secondary" className="text-xs w-fit">
                    <Ticket className="h-3 w-3 mr-1" />
                    Auto-tickets enabled
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowGuestForm(true);
                      setMessages([]);
                      setTicketCreated(false);
                    }}
                    className="h-9 w-full sm:h-10 sm:w-auto text-xs sm:text-sm touch-manipulation"
                  >
                    New Chat
                  </Button>
                </div>
              </div>
            </CardHeader>
            <div className="border-b" />
            <CardContent className="p-0 flex-1 overflow-hidden">
              <ScrollArea className="h-full px-3 sm:px-4 md:px-6 py-2 sm:py-4">
                <div className="space-y-3 sm:space-y-4">
                  {messages.length === 0 ? (
                    <div className="flex items-center justify-center h-48 sm:h-64 text-muted-foreground">
                      <div className="text-center">
                        <Avatar className="h-12 w-12 sm:h-16 sm:w-16 mx-auto mb-3 sm:mb-4">
                          <AvatarFallback className="bg-muted">
                            <Bot className="h-6 w-6 sm:h-8 sm:w-8" />
                          </AvatarFallback>
                        </Avatar>
                        <p className="text-base sm:text-lg font-medium">Start a conversation</p>
                        <p className="text-xs sm:text-sm">Ella chatbot is ready to help</p>
                      </div>
                    </div>
                  ) : (
                    messages.map((msg, index) => (
                      <div 
                        key={index} 
                        className={`flex gap-2 sm:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                      >
                        {msg.role === 'assistant' && (
                          <Avatar className="h-6 w-6 sm:h-8 sm:w-8 mt-1 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10">
                              <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                        <div 
                          className={`max-w-[80%] sm:max-w-[75%] rounded-lg px-2 sm:px-3 py-2 break-words ${
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-medium">
                              {msg.role === 'user' ? 'You' : 'Ella'}
                            </span>
                            <span className="text-xs opacity-70">
                              {formatDistanceToNow(new Date(msg.timestamp), { addSuffix: true })}
                            </span>
                          </div>
                          <p className="whitespace-pre-wrap break-words text-xs sm:text-sm overflow-wrap-anywhere word-break-break-word">{msg.content}</p>
                        </div>
                        {msg.role === 'user' && (
                          <Avatar className="h-6 w-6 sm:h-8 sm:w-8 mt-1 flex-shrink-0">
                            <AvatarFallback className="bg-primary/10">
                              <User className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                            </AvatarFallback>
                          </Avatar>
                        )}
                      </div>
                    ))
                  )}
                  
                  {/* Loading Indicator - Responsive */}
                          {isSubmitting && (
                    <div className="flex gap-2 sm:gap-3 justify-start">
                      <Avatar className="h-6 w-6 sm:h-8 sm:w-8 mt-1 flex-shrink-0">
                        <AvatarFallback className="bg-primary/10">
                          <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
                        </AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-lg px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-2">
                          <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                          <span className="text-xs sm:text-sm">Ella is thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        )}

        {/* Message Input - Responsive */}
        {!showGuestForm && (
          <Card className="mt-3 sm:mt-4">
            <CardContent className="p-3 sm:p-4">
              <form onSubmit={handleSendMessage}>
                <div className="flex gap-2 sm:gap-3">
                  <Input
                    placeholder="Type your message..."
                    className="flex-1 h-9 sm:h-10 text-sm sm:text-base"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleSendMessage(e);
                      }
                    }}
                    // Mobile optimizations
                    autoComplete="off"
                    autoCorrect="off"
                    spellCheck="false"
                  />
                  <Button 
                    type="submit" 
                    size="icon" 
                    className="h-9 w-9 sm:h-10 sm:w-10 flex-shrink-0 touch-manipulation"
                    disabled={isSubmitting || !message.trim()}
                  >
                    {isSubmitting ? (
                      <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                    ) : (
                      <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                  💡 Each message automatically creates a ticket for staff • Press Enter to send
                </p>
              </form>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
