// Copyright (c) 2025 Asset Vault. All rights reserved.

import { Breadcrumbs as MuiBreadcrumbs, Link, Typography } from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import HomeIcon from '@mui/icons-material/Home';

export interface BreadcrumbItem {
  label: string;
  path?: string;
  icon?: React.ReactNode;
}

interface BreadcrumbsProps {
  items?: BreadcrumbItem[];
  showHome?: boolean;
}

export const Breadcrumbs = ({ items = [], showHome = true }: BreadcrumbsProps) => {
  const navigate = useNavigate();
  const location = useLocation();

  const handleClick = (e: React.MouseEvent, path?: string) => {
    e.preventDefault();
    if (path) {
      navigate(path);
    }
  };

  const allItems: BreadcrumbItem[] = showHome
    ? [{ label: 'Home', path: '/', icon: <HomeIcon fontSize="small" /> }, ...items]
    : items;

  return (
    <MuiBreadcrumbs
      separator={<NavigateNextIcon fontSize="small" />}
      aria-label="breadcrumb navigation"
      sx={{ mb: 2 }}
    >
      {allItems.map((item, index) => {
        const isLast = index === allItems.length - 1;
        
        if (isLast || !item.path) {
          return (
            <Typography
              key={item.label}
              color="text.primary"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
                fontWeight: isLast ? 600 : 400,
              }}
            >
              {item.icon}
              {item.label}
            </Typography>
          );
        }

        return (
          <Link
            key={item.label}
            component="button"
            variant="body2"
            onClick={(e) => handleClick(e, item.path)}
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 0.5,
              color: 'text.secondary',
              textDecoration: 'none',
              '&:hover': {
                textDecoration: 'underline',
                color: 'primary.main',
              },
              cursor: 'pointer',
            }}
          >
            {item.icon}
            {item.label}
          </Link>
        );
      })}
    </MuiBreadcrumbs>
  );
};
