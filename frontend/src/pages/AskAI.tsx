import React, { useEffect, useRef, useState } from 'react';
import {
  Avatar, Box, Button, ButtonBase, Card, CardContent, CircularProgress, Dialog,
  DialogActions, DialogContent, DialogContentText, DialogTitle, FormControl, InputLabel,
  MenuItem, Paper, Select, TextField, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import { queryApi } from '../services/api';
import { ChatMessage } from '../types';
import SourceCitations from '../components/SourceCitations';
import ChatMessageContent from '../components/ChatMessageContent';
import useChatHistory from '../hooks/useChatHistory';

const suggestedQuestions = [
  { title: 'Summarize my saved knowledge.', icon: <AutoAwesomeRoundedIcon /> },
  { title: 'Find important information from my documents.', icon: <SearchRoundedIcon /> },
  { title: 'What can you tell me from my saved URLs?', icon: <LinkRoundedIcon /> },
];

function isKnowledgeWideQuestion(question: string): boolean {
  return /\b(?:summari[sz]\w*|summary|summaries|overview|important information|important facts?|key takeaways?|extract)\b/i.test(question) ||
    /\bwhat\s+(?:information|details)\b.*\b(?:saved|stored|available)\b/i.test(question) ||
    /\bwhat can you tell me from my saved\b/i.test(question);
}

export default function AskAI() {
  const {
    history,
    activeConversation,
    messages,
    selectConversation,
    startNewConversation,
    addMessage,
    deleteConversation,
  } = useChatHistory();
  const [input, setInput] = useState('');
  const [loadingConversationId, setLoadingConversationId] = useState<string | null>(null);
  const [loadingQuestion, setLoadingQuestion] = useState('');
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const loading = loadingConversationId !== null;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, loadingConversationId]);

  const submitQuestion = async (question: string) => {
    if (!question || loading || !activeConversation) return;

    const conversationId = activeConversation.id;
    addMessage(conversationId, { role: 'user', content: question, timestamp: new Date() });
    setInput('');
    setLoadingQuestion(question);
    setLoadingConversationId(conversationId);

    try {
      const response = await queryApi.ask(question);
      addMessage(conversationId, {
        role: 'assistant',
        content: response.data?.answer ?? 'No answer returned.',
        sources: response.data?.sources ?? [],
        timestamp: new Date(),
      });
    } catch (error: unknown) {
      addMessage(conversationId, {
        role: 'assistant',
        content: `Error: ${(error as Error).message}`,
        sources: [],
        timestamp: new Date(),
      });
    } finally {
      setLoadingConversationId(null);
      setLoadingQuestion('');
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    await submitQuestion(input.trim());
  };

  const handleClearConversation = () => {
    if (!activeConversation) return;
    if (deleteConversation(activeConversation.id)) {
      setClearDialogOpen(false);
      setInput('');
    }
  };

  const handleSelectConversation = (conversationId: string) => {
    selectConversation(conversationId);
    setInput('');
  };

  return (
    <Box sx={{
      display: 'flex',
      flexDirection: 'column',
      height: { xs: 'calc(100dvh - 7rem)', md: 'calc(100dvh - 5rem)' },
      minHeight: 520,
      maxWidth: 1180,
      mx: 'auto',
    }}>
      <Box sx={{
        display: 'flex',
        alignItems: { xs: 'flex-start', lg: 'center' },
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 2,
        mb: { xs: 2, sm: 2.5 },
      }}>
        <Box>
          <Typography variant="h4">Ask AI</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.6 }}>
            Ask questions about your saved knowledge.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 1, flexWrap: 'wrap', width: { xs: '100%', lg: 'auto' } }}>
          {history.conversations.length > 1 && (
            <FormControl size="small" sx={{ minWidth: { xs: 120, sm: 190 }, maxWidth: 240, flex: { xs: 1, sm: 'initial' } }}>
              <InputLabel id="chat-history-label">Chat history</InputLabel>
              <Select
                labelId="chat-history-label"
                value={activeConversation?.id ?? ''}
                label="Chat history"
                onChange={event => handleSelectConversation(event.target.value)}
                renderValue={selected => history.conversations.find(item => item.id === selected)?.title ?? 'Chat history'}
              >
                {history.conversations.map(conversation => (
                  <MenuItem key={conversation.id} value={conversation.id}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" noWrap>{conversation.title}</Typography>
                      <Typography variant="caption" color="text.secondary">
                        {conversation.updatedAt.toLocaleString()}
                      </Typography>
                    </Box>
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
          <Tooltip title="Start a new chat">
            <Button
              variant="contained"
              size="small"
              startIcon={<AddRoundedIcon />}
              onClick={() => {
                startNewConversation();
                setInput('');
              }}
              sx={{ whiteSpace: 'nowrap' }}
            >
              New Chat
            </Button>
          </Tooltip>
          <Tooltip title="Clear this conversation">
            <span>
              <Button
                variant="outlined"
                color="inherit"
                size="small"
                startIcon={<DeleteOutlineRoundedIcon />}
                disabled={messages.length === 0 || loadingConversationId === activeConversation?.id}
                onClick={() => setClearDialogOpen(true)}
                sx={{ whiteSpace: 'nowrap', color: 'text.secondary', borderColor: 'divider' }}
              >
                Clear Chat
              </Button>
            </span>
          </Tooltip>
        </Box>
      </Box>

      <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto', px: { xs: 0, sm: 1 }, pb: 2 }}>
        {messages.length === 0 ? (
          <Box sx={{
            minHeight: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            px: 1,
            py: { xs: 3, sm: 5 },
          }}>
            <Box sx={{ width: 54, height: 54, display: 'grid', placeItems: 'center', borderRadius: 3, bgcolor: '#eeedff', color: 'primary.main', mb: 2.2 }}>
              <AutoAwesomeRoundedIcon sx={{ fontSize: 28 }} />
            </Box>
            <Typography variant="h5" sx={{ textAlign: 'center' }}>What would you like to know?</Typography>
            <Typography color="text.secondary" sx={{ textAlign: 'center', mt: 0.8, mb: 3, maxWidth: 460 }}>
              Ask questions about the notes and URLs you&apos;ve saved.
            </Typography>
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(3, minmax(0, 1fr))' }, gap: 1.25, width: '100%', maxWidth: 850 }}>
              {suggestedQuestions.map(suggestion => (
                <ButtonBase
                  key={suggestion.title}
                  onClick={() => {
                    setInput(suggestion.title);
                    inputRef.current?.focus();
                  }}
                  sx={{ textAlign: 'left', borderRadius: 2.5, width: '100%' }}
                >
                  <Card variant="outlined" sx={{
                    width: '100%',
                    minHeight: { xs: 64, sm: 108 },
                    display: 'flex',
                    alignItems: { xs: 'center', sm: 'flex-start' },
                    p: 1.5,
                    boxShadow: 'none',
                    transition: 'border-color 140ms ease, background-color 140ms ease',
                    '&:hover': { borderColor: 'primary.light', bgcolor: '#fbfaff' },
                  }}>
                    <CardContent sx={{ p: 0, '&:last-child': { pb: 0 }, display: 'flex', alignItems: { xs: 'center', sm: 'flex-start' }, gap: 1.1 }}>
                      <Box sx={{ color: 'primary.main', display: 'flex', mt: { xs: 0, sm: 0.1 } }}>{suggestion.icon}</Box>
                      <Typography variant="body2" fontWeight={600}>{suggestion.title}</Typography>
                    </CardContent>
                  </Card>
                </ButtonBase>
              ))}
            </Box>
          </Box>
        ) : (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: { xs: 2, sm: 2.5 }, width: '100%', maxWidth: 850, mx: 'auto', pt: 1 }}>
            {messages.map((message: ChatMessage) => (
              <Box
                key={message.id}
                sx={{
                  display: 'flex',
                  justifyContent: message.role === 'user' ? 'flex-end' : 'flex-start',
                  alignItems: 'flex-start',
                  gap: 1.25,
                  width: '100%',
                }}
              >
                {message.role === 'assistant' && (
                  <Avatar sx={{ width: 32, height: 32, bgcolor: '#eeedff', color: 'primary.main', flexShrink: 0 }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                )}
                <Box sx={{ minWidth: 0, maxWidth: { xs: '88%', sm: '82%' } }}>
                  <Paper
                    variant="outlined"
                    sx={{
                      p: { xs: 1.5, sm: 2 },
                      borderRadius: message.role === 'user' ? '18px 18px 5px 18px' : '5px 18px 18px 18px',
                      bgcolor: message.role === 'user' ? '#f0efff' : 'background.paper',
                      borderColor: message.role === 'user' ? '#e5e3ff' : 'divider',
                      boxShadow: 'none',
                    }}
                  >
                    <ChatMessageContent content={message.content} />
                  </Paper>
                  {message.role === 'assistant' && message.sources && message.sources.length > 0 && (
                    <SourceCitations sources={message.sources} />
                  )}
                  <Typography
                    variant="caption"
                    color="text.disabled"
                    sx={{ display: 'block', mt: 0.55, px: 0.4, textAlign: message.role === 'user' ? 'right' : 'left' }}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                  </Typography>
                </Box>
                {message.role === 'user' && (
                  <Avatar sx={{ width: 30, height: 30, bgcolor: '#e8eaf1', color: 'text.secondary', flexShrink: 0 }}>
                    <PersonRoundedIcon sx={{ fontSize: 18 }} />
                  </Avatar>
                )}
              </Box>
            ))}
            {loadingConversationId === activeConversation?.id && (
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.25 }}>
                <Avatar sx={{ width: 32, height: 32, bgcolor: '#eeedff', color: 'primary.main' }}>
                  <AutoAwesomeRoundedIcon sx={{ fontSize: 18 }} />
                </Avatar>
                <Paper variant="outlined" sx={{ p: 1.5, display: 'flex', alignItems: 'center', gap: 1.1, borderRadius: '5px 18px 18px 18px', boxShadow: 'none' }}>
                  <CircularProgress size={16} />
                  <Typography variant="body2" color="text.secondary">
                    {isKnowledgeWideQuestion(loadingQuestion)
                      ? 'Reviewing your saved items and preparing a summary...'
                      : 'Searching your saved knowledge...'}
                  </Typography>
                </Paper>
              </Box>
            )}
            <div ref={bottomRef} />
          </Box>
        )}
      </Box>

      <Box
        component="form"
        onSubmit={handleSubmit}
        sx={{
          position: 'sticky',
          bottom: 0,
          width: '100%',
          maxWidth: 850,
          mx: 'auto',
          pt: 1,
          pb: 0.5,
          bgcolor: 'background.default',
          zIndex: 1,
        }}
      >
        <Paper variant="outlined" sx={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 1,
          p: 0.9,
          pl: 1.5,
          borderRadius: 3,
          bgcolor: 'background.paper',
          boxShadow: '0 5px 20px rgba(32,35,56,0.06)',
          '&:focus-within': { borderColor: 'primary.light', boxShadow: '0 0 0 3px rgba(99,91,219,0.10)' },
        }}>
          <TextField
            inputRef={inputRef}
            fullWidth
            multiline
            maxRows={5}
            variant="standard"
            placeholder="Ask a question about your saved knowledge..."
            value={input}
            onChange={event => setInput(event.target.value)}
            disabled={loading}
            InputProps={{ disableUnderline: true }}
            onKeyDown={event => {
              if (event.key === 'Enter' && !event.shiftKey) {
                event.preventDefault();
                if (!loading && input.trim()) event.currentTarget.closest('form')?.requestSubmit();
              }
            }}
            sx={{ py: 0.6, '& .MuiInputBase-root': { fontSize: '0.94rem', lineHeight: 1.6 } }}
          />
          <Tooltip title="Send message">
            <span>
              <Button
                type="submit"
                variant="contained"
                aria-label="Send message"
                disabled={loading || !input.trim()}
                sx={{ minWidth: 43, width: 43, height: 43, p: 0, borderRadius: 2.5, flexShrink: 0 }}
              >
                {loading ? <CircularProgress size={19} color="inherit" /> : <SendRoundedIcon fontSize="small" />}
              </Button>
            </span>
          </Tooltip>
        </Paper>
        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', textAlign: 'center', mt: 0.65 }}>
          Enter to send · Shift + Enter for a new line
        </Typography>
      </Box>

      <Dialog
        open={clearDialogOpen}
        onClose={() => setClearDialogOpen(false)}
        aria-labelledby="clear-chat-dialog-title"
        aria-describedby="clear-chat-dialog-description"
      >
        <DialogTitle id="clear-chat-dialog-title">Delete conversation?</DialogTitle>
        <DialogContent>
          <DialogContentText id="clear-chat-dialog-description">
            Are you sure you want to delete this conversation? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)}>Cancel</Button>
          <Button color="error" onClick={handleClearConversation} autoFocus>Delete</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
