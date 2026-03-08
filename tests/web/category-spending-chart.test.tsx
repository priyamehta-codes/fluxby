/**
 * Tests for CategorySpendingChart component
 * Tests the stacked bar chart for monthly expenses by category
 */

import { render, screen, fireEvent } from '@testing-library/react';
/** @vitest-environment jsdom */
import React from 'react';
import { vi, describe, it, expect, beforeEach } from 'vitest';

// Mock recharts to avoid canvas issues in tests
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='responsive-container'>{children}</div>
  ),
  BarChart: ({ children }: { children: React.ReactNode }) => (
    <div data-testid='bar-chart'>{children}</div>
  ),
  Bar: () => <div data-testid='bar' />,
  XAxis: () => <div data-testid='xaxis' />,
  YAxis: () => <div data-testid='yaxis' />,
  Tooltip: () => <div data-testid='tooltip' />,
  CartesianGrid: () => <div data-testid='grid' />,
  ReferenceLine: () => <div data-testid='reference-line' />,
}));

// Mock Currency component
vi.mock('@/components/ui/currency', () => ({
  Currency: ({ amount }: { amount: number }) => (
    <span data-testid='currency'>€{amount.toFixed(2)}</span>
  ),
}));

// Mock language context
vi.mock('@/contexts/LanguageContext', () => ({
  useLanguage: () => ({
    t: {
      common: {
        months: [
          'January',
          'February',
          'March',
          'April',
          'May',
          'June',
          'July',
          'August',
          'September',
          'October',
          'November',
          'December',
        ],
        monthsShort: [
          'Jan',
          'Feb',
          'Mar',
          'Apr',
          'May',
          'Jun',
          'Jul',
          'Aug',
          'Sep',
          'Oct',
          'Nov',
          'Dec',
        ],
      },
      analytics: {
        total: 'Total',
        legendLabel: 'Category filter',
      },
    },
    language: 'en',
  }),
}));

import { CategorySpendingChart } from '../../apps/web/src/components/analytics/CategorySpendingChart';

const mockParentCategories = [
  { id: '1', name: 'Food', color: '#FF5733', icon: '🍔' },
  { id: '2', name: 'Transport', color: '#33FF57', icon: '🚗' },
  { id: '3', name: 'Entertainment', color: '#3357FF', icon: '🎬' },
];

const mockData = [
  { month: '2024-01', Food: 150, Transport: 80, Entertainment: 50 },
  { month: '2024-02', Food: 200, Transport: 60, Entertainment: 75 },
  { month: '2024-03', Food: 175, Transport: 90, Entertainment: 40 },
];

describe('CategorySpendingChart', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders chart container', () => {
    render(
      <CategorySpendingChart
        data={mockData}
        parentCategories={mockParentCategories}
      />
    );

    expect(screen.getAllByTestId('bar-chart').length).toBeGreaterThan(0);
  });

  it('renders legend with all categories that have data', () => {
    render(
      <CategorySpendingChart
        data={mockData}
        parentCategories={mockParentCategories}
      />
    );

    // Check legend buttons are rendered
    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText('Transport')).toBeTruthy();
    expect(screen.getByText('Entertainment')).toBeTruthy();
  });

  it('filters out categories without data from legend', () => {
    const categoriesWithEmpty = [
      ...mockParentCategories,
      { id: '4', name: 'Travel', color: '#FFFF33', icon: '✈️' },
    ];

    render(
      <CategorySpendingChart
        data={mockData}
        parentCategories={categoriesWithEmpty}
      />
    );

    // Travel should not appear since it has no data
    expect(screen.queryByText('Travel')).toBeNull();
  });

  it('legend buttons have aria-pressed attribute for accessibility', () => {
    render(
      <CategorySpendingChart
        data={mockData}
        parentCategories={mockParentCategories}
      />
    );

    const foodButton = screen.getByText('Food').closest('button');
    expect(foodButton?.getAttribute('aria-pressed')).toBe('true');
  });

  it('clicking legend button toggles category visibility', () => {
    render(
      <CategorySpendingChart
        data={mockData}
        parentCategories={mockParentCategories}
      />
    );

    const foodButton = screen.getByText('Food').closest('button');
    expect(foodButton?.getAttribute('aria-pressed')).toBe('true');

    // Click to disable
    if (foodButton) fireEvent.click(foodButton);
    expect(foodButton?.getAttribute('aria-pressed')).toBe('false');

    // Click again to enable
    if (foodButton) fireEvent.click(foodButton);
    expect(foodButton?.getAttribute('aria-pressed')).toBe('true');
  });

  it('disabled category shows visual indication (line-through)', () => {
    render(
      <CategorySpendingChart
        data={mockData}
        parentCategories={mockParentCategories}
      />
    );

    const foodButton = screen.getByText('Food').closest('button');

    // Click to disable
    if (foodButton) fireEvent.click(foodButton);

    // Should have line-through class
    expect(foodButton?.className).toContain('line-through');
  });

  it('legend container has role="group" and aria-label', () => {
    render(
      <CategorySpendingChart
        data={mockData}
        parentCategories={mockParentCategories}
      />
    );

    const legendContainer = screen.getByText('Food').closest('[role="group"]');
    expect(legendContainer).toBeTruthy();
    expect(legendContainer?.getAttribute('aria-label')).toBe('Category filter');
  });

  it('handles empty data gracefully', () => {
    render(
      <CategorySpendingChart
        data={[]}
        parentCategories={mockParentCategories}
      />
    );

    // Should render but with no legend items (no data means no categories passed filter)
    expect(screen.queryByText('Food')).toBeNull();
  });

  it('handles single month of data', () => {
    const singleMonth = [{ month: '2024-06', Food: 100, Transport: 50 }];

    render(
      <CategorySpendingChart
        data={singleMonth}
        parentCategories={mockParentCategories}
      />
    );

    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.getByText('Transport')).toBeTruthy();
  });

  it('handles categories with zero values', () => {
    const dataWithZeros = [
      { month: '2024-01', Food: 150, Transport: 0, Entertainment: 0 },
    ];

    render(
      <CategorySpendingChart
        data={dataWithZeros}
        parentCategories={mockParentCategories}
      />
    );

    // Only Food should appear (has data > 0)
    expect(screen.getByText('Food')).toBeTruthy();
    expect(screen.queryByText('Transport')).toBeNull();
    expect(screen.queryByText('Entertainment')).toBeNull();
  });
});
