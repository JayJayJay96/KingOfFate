import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { SETUP_STORAGE_KEY } from '../storage/setupStorage';
import { App } from './App';

function setup() {
  const user = userEvent.setup();
  const utils = render(<App />);
  return { user, ...utils };
}

async function addNames(user: ReturnType<typeof userEvent.setup>, names: string) {
  await user.type(screen.getByLabelText(/paste names/i), names);
  await user.click(screen.getByRole('button', { name: /add to roster/i }));
}

const startButton = () => screen.getByRole('button', { name: /^start$/i });

describe('Setup flow', () => {
  it('starts disabled with an actionable message on an empty roster', () => {
    setup();
    expect(startButton()).toBeDisabled();
    expect(screen.getByText(/need at least 2 active fighters/i)).toBeInTheDocument();
  });

  it('adds pasted names, reports skipped ones and keeps them in the box', async () => {
    const { user } = setup();
    await addNames(user, 'An{Enter}Bình{Enter}an{Enter}{Enter}Chi');

    expect(screen.getByRole('button', { name: 'An' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Bình' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Chi' })).toBeInTheDocument();
    expect(screen.getByText(/added 3 fighters/i)).toBeInTheDocument();
    expect(screen.getByText(/“an” is already on the roster/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/paste names/i)).toHaveValue('an');
    expect(startButton()).toBeEnabled();
  });

  it('enforces N >= W + 1 and updates as attendance and winners change', async () => {
    const { user } = setup();
    await addNames(user, 'An{Enter}Bình{Enter}Chi');

    await user.click(screen.getByRole('radio', { name: '3' }));
    expect(startButton()).toBeDisabled();
    expect(screen.getByText(/3 winners need at least 4 active fighters/i)).toBeInTheDocument();

    await user.click(screen.getByRole('radio', { name: '2' }));
    expect(startButton()).toBeEnabled();
    expect(screen.getByText(/opens in the finale/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Chi' }));
    expect(screen.getByRole('button', { name: 'Chi' })).toHaveAttribute('aria-pressed', 'false');
    expect(startButton()).toBeDisabled();
  });

  it('persists roster, attendance, winners and preset across a remount', async () => {
    const { user, unmount } = setup();
    await addNames(user, 'An{Enter}Bình{Enter}Chi{Enter}Dung');
    await user.click(screen.getByRole('button', { name: 'Bình' }));
    await user.click(screen.getByRole('radio', { name: '2' }));
    await user.click(screen.getByRole('radio', { name: /chaotic/i }));
    unmount();

    expect(localStorage.getItem(SETUP_STORAGE_KEY)).toContain('Dung');
    render(<App />);
    expect(screen.getByRole('button', { name: 'Bình' })).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('radio', { name: '2' })).toBeChecked();
    expect(screen.getByRole('radio', { name: /chaotic/i })).toBeChecked();
    expect(screen.getByTestId('roster-count')).toHaveTextContent('3 in · 4 total');
  });

  it('removes a fighter from the roster', async () => {
    const { user } = setup();
    await addNames(user, 'An{Enter}Bình');
    await user.click(screen.getByRole('button', { name: 'Remove An' }));
    expect(screen.queryByRole('button', { name: 'An' })).not.toBeInTheDocument();
    expect(startButton()).toBeDisabled();
  });

  it('starts into the Phase 1 placeholder with only active fighters, then returns to setup', async () => {
    const { user } = setup();
    await addNames(user, 'An{Enter}Bình{Enter}Chi');
    await user.click(screen.getByRole('button', { name: 'Chi' }));
    await user.click(startButton());

    const lineup = screen.getByRole('list');
    expect(
      within(lineup)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['An', 'Bình']);
    expect(screen.getByText(/gameplay is not implemented yet/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /back to setup/i }));
    expect(screen.getByRole('button', { name: 'Chi' })).toHaveAttribute('aria-pressed', 'false');
  });

  it('shows a notice when saved settings were corrupt', () => {
    localStorage.setItem(SETUP_STORAGE_KEY, '{oops');
    setup();
    expect(screen.getByText(/could not be read, so defaults were loaded/i)).toBeInTheDocument();
  });
});
