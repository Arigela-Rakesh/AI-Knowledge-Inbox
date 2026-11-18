import React, { useEffect, useMemo, useState } from 'react';
import {
  Avatar, Box, Button, Card, CardContent, Divider, Grid, Skeleton, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import LibraryBooksOutlinedIcon from '@mui/icons-material/LibraryBooksOutlined';
import QuestionAnswerOutlinedIcon from '@mui/icons-material/QuestionAnswerOutlined';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import { useNavigate } from 'react-router-dom';
import { itemsApi } from '../services/api';
import { Item } from '../types';
import Notification from '../components/Notification';
import { loadChatHistory } from '../services/chatHistory';

interface StatCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  tint: string;
  loading: boolean;
}

function StatCard({ label, value, icon, tint, loading }: StatCardProps) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.4, '&:last-child': { pb: 2.4 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2.4 }}>
          <Typography variant="body2" color="text.secondary" fontWeight={600}>{label}</Typography>
          <Avatar variant="rounded" sx={{ width: 38, height: 38, bgcolor: tint, color: 'primary.dark' }}>{icon}</Avatar>
        </Box>
        {loading ? (
          <Skeleton variant="text" width={72} height={48} />
        ) : (
          <Typography variant="h4" sx={{ fontSize: '2rem', fontVariantNumeric: 'tabular-nums' }}>{value.toLocaleString()}</Typography>
        )}
      </CardContent>
    </Card>
  );
}

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const questionsAsked = useMemo(() => (
    loadChatHistory()?.conversations.reduce(
      (total, conversation) => total + conversation.messages.filter(message => message.role === 'user').length,
      0
    ) ?? 0
  ), []);

  useEffect(() => {
    itemsApi.getAll()
      .then(response => setItems(response.data ?? []))
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  const notes = items.filter(item => item.source_type === 'note').length;
  const urls = items.filter(item => item.source_type === 'url').length;
  const recent = [...items]
    .sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at))
    .slice(0, 5);

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Box sx={{ mb: 3.5, display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'flex-start', sm: 'center' }, flexWrap: 'wrap', gap: 2 }}>
        <Box>
          <Typography variant="h4">Dashboard</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.65 }}>Your saved knowledge, ready to explore.</Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
          <Button variant="outlined" startIcon={<AddRoundedIcon />} onClick={() => navigate('/add')}>Add Knowledge</Button>
          <Button variant="contained" startIcon={<AutoAwesomeRoundedIcon />} onClick={() => navigate('/ask')}>Ask AI</Button>
        </Box>
      </Box>

      <Notification message={error} onClose={() => setError(null)} />

      <Grid container spacing={2} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label="Saved items" value={items.length} loading={loading} icon={<LibraryBooksOutlinedIcon />} tint="#eeedff" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label="Notes" value={notes} loading={loading} icon={<ArticleOutlinedIcon />} tint="#e8f5f2" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label="URLs" value={urls} loading={loading} icon={<LinkRoundedIcon />} tint="#edf2ff" />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <StatCard label="Questions asked" value={questionsAsked} loading={false} icon={<QuestionAnswerOutlinedIcon />} tint="#fff3e8" />
        </Grid>
      </Grid>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.6 }}>
        <Box>
          <Typography variant="h6">Recently added</Typography>
          <Typography variant="body2" color="text.secondary">The latest items in your knowledge base</Typography>
        </Box>
        {items.length > 0 && (
          <Button endIcon={<ArrowForwardRoundedIcon />} onClick={() => navigate('/knowledge')} sx={{ whiteSpace: 'nowrap' }}>
            View all
          </Button>
        )}
      </Box>

      <Card>
        {loading ? (
          <CardContent sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            {[1, 2, 3].map(key => <Skeleton key={key} variant="rounded" height={66} />)}
          </CardContent>
        ) : recent.length === 0 ? (
          <CardContent sx={{ py: 6, textAlign: 'center' }}>
            <Avatar sx={{ width: 48, height: 48, bgcolor: '#eeedff', color: 'primary.main', mx: 'auto', mb: 1.5 }}>
              <LibraryBooksOutlinedIcon />
            </Avatar>
            <Typography variant="subtitle1">Your knowledge base is ready</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 2 }}>
              Add a note or save a URL to make it searchable.
            </Typography>
            <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/add')}>
              Add your first item
            </Button>
          </CardContent>
        ) : (
          recent.map((item, index) => (
            <React.Fragment key={item.id}>
              {index > 0 && <Divider />}
              <Box
                component="button"
                onClick={() => navigate('/knowledge')}
                sx={{
                  width: '100%',
                  border: 0,
                  bgcolor: 'transparent',
                  px: { xs: 1.5, sm: 2.25 },
                  py: 1.65,
                  display: 'flex',
                  alignItems: 'center',
                  textAlign: 'left',
                  gap: 1.5,
                  cursor: 'pointer',
                  transition: 'background-color 120ms ease',
                  '&:hover': { bgcolor: '#fafaff' },
                }}
              >
                <Avatar variant="rounded" sx={{ width: 40, height: 40, bgcolor: item.source_type === 'url' ? '#edf2ff' : '#e8f5f2', color: item.source_type === 'url' ? '#5267bd' : '#168f98', flexShrink: 0 }}>
                  {item.source_type === 'url' ? <LinkRoundedIcon fontSize="small" /> : <ArticleOutlinedIcon fontSize="small" />}
                </Avatar>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" color="text.primary" fontWeight={650} noWrap>{item.title}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap sx={{ display: 'block', mt: 0.25 }}>
                    {item.preview || item.source_url || 'Saved note'}
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.disabled" sx={{ display: { xs: 'none', sm: 'block' }, whiteSpace: 'nowrap' }}>
                  {new Date(item.created_at).toLocaleDateString()}
                </Typography>
                <ArrowForwardRoundedIcon sx={{ color: 'text.disabled', fontSize: 18 }} />
              </Box>
            </React.Fragment>
          ))
        )}
      </Card>
    </Box>
  );
}
