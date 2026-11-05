import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import {
  Avatar,
  ErrorFallback,
  IconButton,
  initialsFrom,
  LoadingSkeleton,
  MetricCard,
  PrimaryButton,
  SearchField,
  SecondaryButton,
  StatusChip,
  TextField,
} from '@/components';

const metrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function renderWithSafeArea(ui: React.ReactElement) {
  return render(<SafeAreaProvider initialMetrics={metrics}>{ui}</SafeAreaProvider>);
}

describe('buttons', () => {
  it('calls onPress and exposes the label', () => {
    const onPress = jest.fn();
    render(<PrimaryButton label="Save" onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Save' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not fire when disabled and reports the disabled state', () => {
    const onPress = jest.fn();
    render(<SecondaryButton label="Cancel" onPress={onPress} disabled />);
    const button = screen.getByRole('button', { name: 'Cancel' });
    fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
    expect(button).toBeDisabled();
  });

  it('marks loading buttons busy', () => {
    render(<PrimaryButton label="Save" onPress={() => {}} loading />);
    expect(screen.getByRole('button', { name: 'Save' })).toBeBusy();
  });

  it('requires an accessible label on icon buttons', () => {
    render(<IconButton icon="close" accessibilityLabel="Close" onPress={() => {}} />);
    expect(screen.getByRole('button', { name: 'Close' })).toBeTruthy();
  });
});

describe('inputs', () => {
  it('labels the text field and shows the error', () => {
    render(<TextField label="Full name" value="" onChangeText={() => {}} errorText="Required" />);
    expect(screen.getByLabelText('Full name')).toBeTruthy();
    expect(screen.getByText('Required')).toBeTruthy();
  });

  it('clears the search field', () => {
    function Harness() {
      const [value, setValue] = useState('asha');
      return <SearchField label="Search patients" value={value} onChangeText={setValue} />;
    }
    render(<Harness />);
    fireEvent.press(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getByLabelText('Search patients').props.value).toBe('');
    expect(screen.queryByRole('button', { name: 'Clear search' })).toBeNull();
  });
});

describe('display components', () => {
  it('derives initials', () => {
    expect(initialsFrom('Asha Rao')).toBe('AR');
    expect(initialsFrom('  madhu  ')).toBe('M');
    expect(initialsFrom('Anil Kumar Reddy')).toBe('AR');
    expect(initialsFrom('')).toBe('?');
  });

  it('labels avatars with the full name', () => {
    render(<Avatar name="Demo User" />);
    expect(screen.getByLabelText('Demo User')).toBeTruthy();
  });

  it('announces chip status in words, not colour alone', () => {
    render(<StatusChip label="Waiting" tone="warning" />);
    expect(screen.getByLabelText('Status: Waiting')).toBeTruthy();
  });

  it('reads a metric as one unit', () => {
    renderWithSafeArea(<MetricCard label="Beds" value="32" caption="of 120" />);
    expect(screen.getByLabelText('Beds, 32, of 120')).toBeTruthy();
  });

  it('exposes loading skeletons as a busy progress indicator', () => {
    render(<LoadingSkeleton accessibilityLabel="Loading list" />);
    expect(screen.getByLabelText('Loading list')).toBeBusy();
  });
});

describe('ErrorFallback', () => {
  it('shows a generic message, dev detail, and retries', () => {
    const onRetry = jest.fn();
    renderWithSafeArea(<ErrorFallback error={new Error('boom')} onRetry={onRetry} />);
    expect(screen.getByText('Something went wrong')).toBeTruthy();
    expect(screen.getByTestId('error-detail')).toHaveTextContent('boom');
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});
