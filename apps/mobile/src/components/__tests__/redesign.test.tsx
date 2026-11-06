import { fireEvent, render, screen } from '@testing-library/react-native';
import { useState } from 'react';

import {
  ChoiceGroup,
  DataRow,
  EmptyState,
  ErrorState,
  SegmentedControl,
  StatusBadge,
  TextField,
  statusTone,
} from '@/components';

function Group() {
  const [value, setValue] = useState<'female' | 'male'>('female');
  return (
    <ChoiceGroup
      label="Sex"
      value={value}
      onChange={setValue}
      options={[
        { value: 'female', label: 'Female' },
        { value: 'male', label: 'Male' },
      ]}
    />
  );
}

describe('redesigned components', () => {
  it('announces the chosen chip as selected instead of disabling it', () => {
    render(<Group />);
    expect(screen.getByRole('radio', { name: 'Female' })).toBeSelected();
    fireEvent.press(screen.getByRole('radio', { name: 'Male' }));
    expect(screen.getByRole('radio', { name: 'Male' })).toBeSelected();
    expect(screen.getByRole('radio', { name: 'Female' })).not.toBeSelected();
    expect(screen.getByRole('radio', { name: 'Female' })).not.toBeDisabled();
  });

  it('switches segments and reports the selected tab', () => {
    const onChange = jest.fn();
    render(
      <SegmentedControl
        label="Invoice status"
        value="issued"
        onChange={onChange}
        options={[
          { value: 'draft', label: 'Draft' },
          { value: 'issued', label: 'Issued' },
        ]}
      />,
    );
    expect(screen.getByRole('tab', { name: 'Issued' })).toBeSelected();
    fireEvent.press(screen.getByRole('tab', { name: 'Draft' }));
    expect(onChange).toHaveBeenCalledWith('draft');
  });

  it('reads a data row as one unit, including removed lines', () => {
    render(<DataRow label="Lab charges" value="₹350.00" inactive />);
    expect(screen.getByLabelText('Lab charges, ₹350.00, removed')).toBeTruthy();
  });

  it('maps statuses to one consistent tone everywhere', () => {
    expect(statusTone('paid')).toBe('success');
    expect(statusTone('verified')).toBe('success');
    expect(statusTone('checked_in')).toBe('warning');
    expect(statusTone('cancelled')).toBe('danger');
    expect(statusTone('booked')).toBe('info');
    expect(statusTone('something_new')).toBe('neutral');
    render(<StatusBadge label="Paid" tone={statusTone('paid')} />);
    expect(screen.getByLabelText('Status: Paid')).toBeTruthy();
  });

  it('shows offline and permission-denied states, with retry only where it can help', () => {
    const retry = jest.fn();
    const { rerender } = render(<ErrorState variant="offline" onRetry={retry} />);
    expect(screen.getByText('You are offline')).toBeTruthy();
    fireEvent.press(screen.getByRole('button', { name: 'Try again' }));
    expect(retry).toHaveBeenCalled();
    rerender(<ErrorState variant="forbidden" onRetry={retry} />);
    expect(screen.getByText('Not available for your role')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('gives an empty state its next action', () => {
    const onPress = jest.fn();
    render(<EmptyState title="No visits yet" action={{ label: 'Book', onPress }} />);
    fireEvent.press(screen.getByRole('button', { name: 'Book' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('lets a password field be shown and hidden', () => {
    render(
      <TextField
        label="Password"
        value="secret"
        onChangeText={() => {}}
        secureTextEntry
        revealable
      />,
    );
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(true);
    fireEvent.press(screen.getByRole('button', { name: 'Show password' }));
    expect(screen.getByLabelText('Password').props.secureTextEntry).toBe(false);
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy();
  });
});
