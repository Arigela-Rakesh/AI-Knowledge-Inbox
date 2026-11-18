import React, { useState } from 'react';
import {
  Box, Button, Card, CardContent, LinearProgress, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import ArticleOutlinedIcon from '@mui/icons-material/ArticleOutlined';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import { ingestApi } from '../services/api';
import Notification from '../components/Notification';

export default function AddKnowledge() {
  const [tab, setTab] = useState(0);
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [url, setUrl] = useState('');
  const [urlTitle, setUrlTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleNoteSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!noteTitle.trim() || !noteContent.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await ingestApi.note(noteTitle.trim(), noteContent.trim());
      setSuccess(`Note saved. Created ${response.data?.chunksCreated} searchable chunks and ${response.data?.embeddingsCreated} embeddings.`);
      setNoteTitle('');
      setNoteContent('');
    } catch (requestError: unknown) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const handleUrlSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!url.trim()) return;
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const response = await ingestApi.url(url.trim(), urlTitle.trim() || undefined);
      setSuccess(`URL saved. Extracted content into ${response.data?.chunksCreated} searchable chunks and created ${response.data?.embeddingsCreated} embeddings.`);
      setUrl('');
      setUrlTitle('');
    } catch (requestError: unknown) {
      setError((requestError as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Box sx={{ maxWidth: 980, mx: 'auto' }}>
      <Box sx={{ mb: 3.5 }}>
        <Typography variant="h4">Add Knowledge</Typography>
        <Typography color="text.secondary" sx={{ mt: 0.65 }}>
          Save useful notes and pages so you can find them with AI later.
        </Typography>
      </Box>

      <Notification message={error} severity="error" onClose={() => setError(null)} />
      <Notification message={success} severity="success" onClose={() => setSuccess(null)} />

      <Card>
        <Tabs
          value={tab}
          onChange={(_, value: number) => setTab(value)}
          aria-label="Choose what to add"
          variant="fullWidth"
          sx={{ px: { xs: 0.5, sm: 2 }, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minHeight: 64 } }}
        >
          <Tab icon={<ArticleOutlinedIcon />} iconPosition="start" label="Add a note" />
          <Tab icon={<LinkRoundedIcon />} iconPosition="start" label="Save a URL" />
        </Tabs>
        {loading && <LinearProgress />}
        <CardContent sx={{ p: { xs: 2, sm: 3.5 }, '&:last-child': { pb: { xs: 2, sm: 3.5 } } }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5, p: 2, mb: 3, borderRadius: 2.5, bgcolor: '#f5f4ff', border: '1px solid #e8e6ff' }}>
            <AutoAwesomeRoundedIcon sx={{ color: 'primary.main', mt: 0.2 }} />
            <Box>
              <Typography variant="body2" fontWeight={650}>Make it searchable</Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>
                Your content is organized into passages and indexed locally, so Ask AI can retrieve relevant details and cite their source.
              </Typography>
            </Box>
          </Box>

          {tab === 0 && (
            <Box component="form" onSubmit={handleNoteSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
              <TextField
                label="Note title"
                placeholder="e.g. Product launch research"
                value={noteTitle}
                onChange={event => setNoteTitle(event.target.value)}
                required
                fullWidth
                inputProps={{ maxLength: 500 }}
                helperText={`${noteTitle.length}/500`}
                disabled={loading}
              />
              <TextField
                label="Content"
                placeholder="Add the details you want to remember and ask questions about..."
                value={noteContent}
                onChange={event => setNoteContent(event.target.value)}
                required
                fullWidth
                multiline
                minRows={9}
                maxRows={18}
                inputProps={{ maxLength: 100000 }}
                helperText={`${noteContent.length.toLocaleString()} / 100,000 characters`}
                disabled={loading}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Tip: include names, dates, and context to make answers more precise.
                </Typography>
                <Button type="submit" variant="contained" size="large" disabled={loading || !noteTitle.trim() || !noteContent.trim()} startIcon={<ArticleOutlinedIcon />}>
                  {loading ? 'Saving note…' : 'Save note'}
                </Button>
              </Box>
            </Box>
          )}

          {tab === 1 && (
            <Box component="form" onSubmit={handleUrlSubmit} sx={{ display: 'flex', flexDirection: 'column', gap: 2.25 }}>
              <TextField
                label="Page URL"
                value={url}
                onChange={event => setUrl(event.target.value)}
                required
                fullWidth
                type="url"
                placeholder="https://example.com/article"
                helperText="Use a complete, publicly accessible URL beginning with https://"
                disabled={loading}
              />
              <TextField
                label="Title (optional)"
                value={urlTitle}
                onChange={event => setUrlTitle(event.target.value)}
                fullWidth
                placeholder="Leave blank to use the page title"
                disabled={loading}
              />
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
                <Typography variant="caption" color="text.secondary">
                  Page text is extracted and indexed; the original page remains your citation.
                </Typography>
                <Button type="submit" variant="contained" size="large" disabled={loading || !url.trim()} startIcon={<LinkRoundedIcon />}>
                  {loading ? 'Processing URL…' : 'Save URL'}
                </Button>
              </Box>
            </Box>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}
