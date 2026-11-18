import React from 'react';
import { Box, Typography, SvgIconProps } from '@mui/material';
import InboxIcon from '@mui/icons-material/Inbox';

interface Props {
  title: string;
  description?: string;
  icon?: React.ReactElement<SvgIconProps>;
}

export default function EmptyState({ title, description, icon }: Props) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', py: 10, gap: 2 }}>
      <Box sx={{ color: 'text.disabled', fontSize: 64 }}>
        {icon ?? <InboxIcon sx={{ fontSize: 64 }} />}
      </Box>
      <Typography variant="h6" color="text.secondary" fontWeight={600}>{title}</Typography>
      {description && <Typography variant="body2" color="text.disabled" textAlign="center" maxWidth={400}>{description}</Typography>}
    </Box>
  );
}
