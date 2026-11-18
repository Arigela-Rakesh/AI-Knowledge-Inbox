import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Box, Button, Card, CardActions, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Grid, IconButton, InputAdornment, Link, Skeleton, TextField,
  ToggleButton, ToggleButtonGroup, Tooltip, Typography,
} from '@mui/material';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { useNavigate } from 'react-router-dom';
import { itemsApi } from '../services/api';
import { Item } from '../types';
import EmptyState from '../components/EmptyState';
import Notification from '../components/Notification';
import LoadingSpinner from '../components/LoadingSpinner';

type SourceFilter = 'all' | 'note' | 'url';

export default function MyKnowledge() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<SourceFilter>('all');
  const [selected, setSelected] = useState<Item | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(() => {
    setLoading(true);
    itemsApi.getAll()
      .then(response => setItems(response.data ?? []))
      .catch((requestError: Error) => setError(requestError.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(item => {
      const matchesFilter = filter === 'all' || item.source_type === filter;
      const searchableText = `${item.title} ${item.preview ?? ''} ${item.source_url ?? ''}`.toLowerCase();
      return matchesFilter && (!query || searchableText.includes(query));
    });
  }, [items, search, filter]);

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      await itemsApi.delete(deleteId);
      setSuccess('Knowledge item deleted.');
      setDeleteId(null);
      load();
    } catch (requestError: unknown) {
      setError((requestError as Error).message);
      setDeleteId(null);
    }
  };

  const handleViewDetail = async (item: Item) => {
    try {
      const response = await itemsApi.getById(item.id);
      setSelected(response.data ?? item);
    } catch {
      setSelected(item);
    }
  };

  const selectedForDelete = items.find(item => item.id === deleteId);

  return (
    <Box sx={{ maxWidth: 1180, mx: 'auto' }}>
      <Box sx={{ display: 'flex', alignItems: { xs: 'flex-start', sm: 'center' }, justifyContent: 'space-between', flexWrap: 'wrap', gap: 2, mb: 3 }}>
        <Box>
          <Typography variant="h4">My Knowledge</Typography>
          <Typography color="text.secondary" sx={{ mt: 0.65 }}>Find and manage your saved notes and URLs.</Typography>
        </Box>
        <Button variant="contained" startIcon={<AddRoundedIcon />} onClick={() => navigate('/add')}>
          Add Knowledge
        </Button>
      </Box>

      <Notification message={error} severity="error" onClose={() => setError(null)} />
      <Notification message={success} severity="success" onClose={() => setSuccess(null)} />

      <Card sx={{ mb: 2.5 }}>
        <CardContent sx={{ p: { xs: 1.5, sm: 2 }, '&:last-child': { pb: { xs: 1.5, sm: 2 } } }}>
          <Box sx={{ display: 'flex', alignItems: { xs: 'stretch', md: 'center' }, gap: 1.5, flexDirection: { xs: 'column', md: 'row' } }}>
            <TextField
              placeholder="Search titles, content, or URLs"
              value={search}
              onChange={event => setSearch(event.target.value)}
              fullWidth
              InputProps={{ startAdornment: <InputAdornment position="start"><SearchRoundedIcon fontSize="small" color="action" /></InputAdornment> }}
            />
            <ToggleButtonGroup
              exclusive
              value={filter}
              onChange={(_, value: SourceFilter | null) => value && setFilter(value)}
              aria-label="Filter by source type"
              size="small"
              sx={{ flexShrink: 0, '& .MuiToggleButton-root': { px: 1.7, textTransform: 'none', whiteSpace: 'nowrap' } }}
            >
              <ToggleButton value="all">All items</ToggleButton>
              <ToggleButton value="note">Notes</ToggleButton>
              <ToggleButton value="url">URLs</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </CardContent>
      </Card>

      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {loading ? 'Loading your items…' : `${filtered.length} ${filtered.length === 1 ? 'item' : 'items'}`}
        </Typography>
        {!loading && search && (
          <Typography variant="caption" color="text.disabled">
            Search results in {items.length} saved {items.length === 1 ? 'item' : 'items'}
          </Typography>
        )}
      </Box>

      {loading ? (
        <Grid container spacing={2}>
          {[1, 2, 3].map(key => (
            <Grid item xs={12} md={6} xl={4} key={key}>
              <Skeleton variant="rounded" height={210} />
            </Grid>
          ))}
        </Grid>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent sx={{ py: 6 }}>
            <EmptyState
              title={search || filter !== 'all' ? 'No matching items' : 'Nothing saved yet'}
              description={search || filter !== 'all' ? 'Try another search or source filter.' : 'Add a note or URL to start building your searchable knowledge base.'}
              icon={<ArticleOutlinedIcon sx={{ fontSize: 56 }} />}
            />
          </CardContent>
        </Card>
      ) : (
        <Grid container spacing={2}>
          {filtered.map(item => (
            <Grid item xs={12} md={6} xl={4} key={item.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', transition: 'border-color 140ms ease, transform 140ms ease', '&:hover': { borderColor: '#d7d4ff', transform: 'translateY(-2px)' } }}>
                <CardContent sx={{ flex: 1, p: 2.25 }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.7 }}>
                    <Box sx={{ width: 34, height: 34, display: 'grid', placeItems: 'center', borderRadius: 2, bgcolor: item.source_type === 'url' ? '#edf2ff' : '#e8f5f2', color: item.source_type === 'url' ? '#5267bd' : '#168f98' }}>
                      {item.source_type === 'url' ? <LinkRoundedIcon fontSize="small" /> : <ArticleOutlinedIcon fontSize="small" />}
                    </Box>
                    <Chip
                      label={item.source_type === 'url' ? 'URL' : 'Note'}
                      size="small"
                      variant="outlined"
                      sx={{ borderColor: 'divider', color: 'text.secondary', bgcolor: '#fff' }}
                    />
                    <Typography variant="caption" color="text.disabled" sx={{ ml: 'auto', whiteSpace: 'nowrap' }}>
                      {new Date(item.created_at).toLocaleDateString()}
                    </Typography>
                  </Box>
                  <Typography variant="subtitle1" sx={{ mb: 0.75, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>
                    {item.title}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: 60 }}>
                    {item.preview || 'No preview available.'}
                  </Typography>
                  {item.source_url && (
                    <Link
                      href={item.source_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      variant="caption"
                      underline="hover"
                      sx={{ mt: 1.25, display: 'flex', alignItems: 'center', gap: 0.5, overflow: 'hidden' }}
                    >
                      <LinkRoundedIcon sx={{ fontSize: 15, flexShrink: 0 }} />
                      <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.source_url}</Box>
                      <LaunchRoundedIcon sx={{ fontSize: 13, flexShrink: 0 }} />
                    </Link>
                  )}
                </CardContent>
                <Divider />
                <CardActions sx={{ px: 2, py: 1, justifyContent: 'space-between' }}>
                  <Button size="small" startIcon={<VisibilityOutlinedIcon />} onClick={() => handleViewDetail(item)}>
                    View details
                  </Button>
                  <Tooltip title="Delete item">
                    <IconButton aria-label={`Delete ${item.title}`} size="small" color="default" onClick={() => setDeleteId(item.id)}>
                      <DeleteOutlineRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </CardActions>
              </Card>
            </Grid>
          ))}
        </Grid>
      )}

      <Dialog open={!!selected} onClose={() => setSelected(null)} maxWidth="md" fullWidth>
        <DialogTitle sx={{ pr: 6, wordBreak: 'break-word' }}>{selected?.title}</DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2, flexWrap: 'wrap' }}>
            <Chip label={selected?.source_type === 'url' ? 'URL' : 'Note'} size="small" variant="outlined" />
            <Typography variant="caption" color="text.secondary">
              {selected && new Date(selected.created_at).toLocaleString()}
            </Typography>
          </Box>
          {selected?.source_url && (
            <Link href={selected.source_url} target="_blank" rel="noopener noreferrer" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mb: 2, wordBreak: 'break-all' }}>
              {selected.source_url}<LaunchRoundedIcon sx={{ fontSize: 15 }} />
            </Link>
          )}
          <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', lineHeight: 1.8 }}>
            {selected?.content ?? selected?.preview}
          </Typography>
          {selected?.chunks && selected.chunks.length > 0 && (
            <Box sx={{ mt: 3 }}>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1.25 }}>
                Searchable chunks ({selected.chunks.length})
              </Typography>
              {selected.chunks.map(chunk => (
                <Box key={chunk.id} sx={{ bgcolor: '#f7f8fb', p: 1.5, borderRadius: 2, mb: 1 }}>
                  <Typography variant="caption" color="text.disabled">
                    Chunk {chunk.chunk_index + 1} · {chunk.token_count} tokens
                  </Typography>
                  <Typography variant="body2" sx={{ mt: 0.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                    {chunk.content}
                  </Typography>
                </Box>
              ))}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelected(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Dialog open={!!deleteId} onClose={() => setDeleteId(null)}>
        <DialogTitle>Delete knowledge item?</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            This will permanently remove {selectedForDelete ? `“${selectedForDelete.title}”` : 'this item'} and its searchable chunks.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteId(null)}>Cancel</Button>
          <Button color="error" variant="contained" onClick={handleDelete}>Delete item</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
