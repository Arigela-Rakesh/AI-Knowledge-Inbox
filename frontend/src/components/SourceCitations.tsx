import React from 'react';
import { Box, Card, CardContent, Typography, Chip, Link } from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import ArticleIcon from '@mui/icons-material/Article';
import { SourceCitation } from '../types';

interface Props { sources: SourceCitation[]; }

export default function SourceCitations({ sources }: Props) {
  if (sources.length === 0) return null;
  const uniqueSources = Array.from(
    new Map(sources.map(source => [source.itemId, source])).values()
  );

  return (
    <Box sx={{ mt: 1.75 }}>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1, fontWeight: 700, letterSpacing: '0.04em' }}>
        SOURCES · {uniqueSources.length}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {uniqueSources.map((source, i) => (
          <Card key={source.itemId} variant="outlined" sx={{ borderRadius: 2.5, bgcolor: '#fbfbfd', boxShadow: 'none' }}>
            <CardContent sx={{ p: 1.35, '&:last-child': { pb: 1.35 } }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 0.8, minWidth: 0 }}>
                {source.url ? <LinkIcon fontSize="small" color="primary" /> : <ArticleIcon fontSize="small" color="primary" />}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography variant="body2" fontWeight={650} noWrap>
                    [{i + 1}] {source.title}
                  </Typography>
                  {source.url && (
                    <Link href={source.url} target="_blank" rel="noopener noreferrer" variant="caption" color="primary" sx={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {source.url}
                    </Link>
                  )}
                </Box>
                {source.similarity !== undefined && (
                  <Chip
                    label={`${(source.similarity * 100).toFixed(0)}% match`}
                    size="small"
                    variant="outlined"
                    sx={{ flexShrink: 0, height: 23, bgcolor: 'white', color: 'text.secondary', borderColor: 'divider', fontSize: '0.7rem' }}
                  />
                )}
              </Box>
              <Typography variant="caption" color="text.secondary" sx={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: 1.55 }}>
                {source.snippet}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Box>
    </Box>
  );
}
