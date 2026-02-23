// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import ModeBadge from '../ModeBadge';

describe('ModeBadge', () => {
  it('renders physical label', () => {
    render(<ModeBadge mode="PHYSICAL" />);
    expect(screen.getByText('PHYSICAL')).toBeTruthy();
  });

  it('renders remote label', () => {
    render(<ModeBadge mode="REMOTE" />);
    expect(screen.getByText('REMOTE')).toBeTruthy();
  });

  it('renders hybrid label', () => {
    render(<ModeBadge mode="HYBRID" />);
    expect(screen.getByText('HYBRID')).toBeTruthy();
  });
});
