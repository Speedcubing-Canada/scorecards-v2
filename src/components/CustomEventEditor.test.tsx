// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '../i18n/index';
import type { CustomEvent } from '../types/settings';
import { renderWithProviders, useEnglish } from '../test/render';
import CustomEventEditor from './CustomEventEditor';

// The editor behind both the Settings page's Advanced section and the custom-competition
// builder. Everything an organizer types here ends up printed on a scorecard with no WCIF
// to fall back on, so the parts worth pinning are the ones that silently drop or keep data:
// removing the right row, clearing a cutoff that the chosen format cannot have, and the two
// FileReader paths (icon, competitor CSV).

/** The component is controlled; hold its state so a sequence of edits behaves like the app. */
function Harness({ initial = [] as CustomEvent[] }) {
  const [events, setEvents] = useState<CustomEvent[]>(initial);
  return (
    <>
      <CustomEventEditor events={events} onChange={setEvents} />
      <output data-testid="state">{JSON.stringify(events)}</output>
    </>
  );
}

const state = (): CustomEvent[] => JSON.parse(screen.getByTestId('state').textContent!);

const addButton = () => screen.getByRole('button', { name: i18n.t('settings.advanced.add_custom_event') });
const nameBoxes = () => screen.getAllByPlaceholderText(i18n.t('settings.advanced.event_name_placeholder'));

const event = (over: Partial<CustomEvent> = {}): CustomEvent => ({
  name: 'Mystery Puzzle', iconDataUrl: null, format: 'avg5', cutoff: '', limit: '', ...over,
});

const mount = (initial?: CustomEvent[]) =>
  renderWithProviders(<Harness initial={initial ?? []} />);

beforeEach(async () => { await useEnglish(); });
afterEach(cleanup);

describe('adding and removing', () => {
  it('starts empty and adds a blank event on request', () => {
    mount();
    expect(screen.queryAllByPlaceholderText(i18n.t('settings.advanced.event_name_placeholder'))).toHaveLength(0);

    fireEvent.click(addButton());
    expect(state()).toEqual([event({ name: '' })]);
  });

  it('removes the row that was clicked, not the last one', () => {
    // Splicing the wrong index silently reassigns every icon and CSV below it.
    mount([event({ name: 'First' }), event({ name: 'Second' }), event({ name: 'Third' })]);
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('common.remove') })[1]);

    expect(state().map(e => e.name)).toEqual(['First', 'Third']);
  });

  it('edits only the row that was typed in', () => {
    mount([event({ name: 'First' }), event({ name: 'Second' })]);
    fireEvent.change(nameBoxes()[1], { target: { value: 'Renamed' } });

    expect(state().map(e => e.name)).toEqual(['First', 'Renamed']);
  });
});

describe('format and its fields', () => {
  it('records the chosen format', () => {
    mount([event()]);
    fireEvent.click(screen.getByLabelText(i18n.t('settings.advanced.mo3')));
    expect(state()[0].format).toBe('mo3');
  });

  it('clears a cutoff when switching to a format that cannot have one', () => {
    // bo2/bo1 have no post-cutoff phase; a stale cutoff would print on the scorecard anyway.
    mount([event({ cutoff: '1:00' })]);
    fireEvent.click(screen.getByLabelText(i18n.t('settings.advanced.bo2')));

    expect(state()[0]).toMatchObject({ format: 'bo2', cutoff: '' });
    expect(screen.queryByText(i18n.t('settings.advanced.cutoff_label'))).toBeNull();
  });

  it('keeps the cutoff field for the formats that have one', () => {
    mount([event({ format: 'bo2' })]);
    fireEvent.click(screen.getByLabelText(i18n.t('settings.advanced.bo3')));
    expect(screen.getByText(i18n.t('settings.advanced.cutoff_label'))).toBeTruthy();
  });

  it('records the time limit and the optional round label', () => {
    mount([event()]);
    const [cutoff, limit] = screen.getAllByPlaceholderText('M:SS');
    fireEvent.change(cutoff, { target: { value: '1:00' } });
    fireEvent.change(limit, { target: { value: '10:00' } });
    fireEvent.change(
      screen.getByPlaceholderText(i18n.t('settings.advanced.round_label_placeholder')),
      { target: { value: 'Round 2' } },
    );

    expect(state()[0]).toMatchObject({ cutoff: '1:00', limit: '10:00', roundLabel: 'Round 2' });
  });
});

describe('the event icon', () => {
  const wcaIcon = () => screen.getByTitle('3×3');

  it('picks a WCA event icon', () => {
    mount([event()]);
    fireEvent.click(wcaIcon());
    expect(state()[0].iconDataUrl).toBeTruthy();
  });

  it('clicking the chosen icon again clears it', () => {
    mount([event()]);
    fireEvent.click(wcaIcon());
    fireEvent.click(wcaIcon());
    expect(state()[0].iconDataUrl).toBeNull();
  });

  it('is keyboard reachable', () => {
    mount([event()]);
    fireEvent.keyDown(wcaIcon(), { key: 'Enter' });
    expect(state()[0].iconDataUrl).toBeTruthy();
  });

  it('reads an uploaded image as a data URL', async () => {
    const { container } = mount([event()]);
    const input = container.querySelector('input[accept="image/*"]') as HTMLInputElement;
    const file = new File(['not-really-a-png'], 'logo.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });

    // The PDF embeds the data URL directly; a File reference would not survive sessionStorage.
    await waitFor(() => expect(state()[0].iconDataUrl).toMatch(/^data:image\/png;base64,/));
  });

  it('ignores a cancelled file picker', () => {
    const { container } = mount([event({ iconDataUrl: 'data:image/png;base64,AAA' })]);
    const input = container.querySelector('input[accept="image/*"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });

    expect(state()[0].iconDataUrl).toBe('data:image/png;base64,AAA');
  });

  it('offers an explicit clear once an icon is set', () => {
    mount([event({ iconDataUrl: 'data:image/png;base64,AAA' })]);
    fireEvent.click(screen.getByRole('button', { name: i18n.t('common.clear') }));
    expect(state()[0].iconDataUrl).toBeNull();
  });
});

describe('the competitor CSV', () => {
  const csvInput = (container: HTMLElement) =>
    container.querySelector('input[accept=".csv,text/csv,text/plain"]') as HTMLInputElement;

  const upload = (container: HTMLElement, text: string, name = 'people.csv') =>
    fireEvent.change(csvInput(container), {
      target: { files: [new File([text], name, { type: 'text/csv' })] },
    });

  it('parses an uploaded roster and shows its file name and count', async () => {
    const { container } = mount([event()]);
    upload(container, 'Name\nAda Lovelace\nGrace Hopper\n');

    await waitFor(() => expect(state()[0].competitors).toHaveLength(2));
    expect(screen.getByText('people.csv')).toBeTruthy();
  });

  it('removing the roster drops the competitors and the file name', async () => {
    const { container } = mount([event()]);
    upload(container, 'Name\nAda Lovelace\n');
    await waitFor(() => expect(state()[0].competitors).toHaveLength(1));

    // The row's own Remove comes first in the DOM; the roster's is the last one.
    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('common.remove') }).at(-1)!);
    expect(state()[0].competitors).toBeUndefined();
    expect(screen.queryByText('people.csv')).toBeNull();
  });

  it('keeps each row\'s file name with its own row when one above is removed', async () => {
    // csvNames is keyed by index, so removing a row has to shift the keys down; otherwise
    // the surviving event shows the deleted one's file name.
    const { container } = mount([event({ name: 'First' }), event({ name: 'Second' })]);
    const inputs = container.querySelectorAll('input[accept=".csv,text/csv,text/plain"]');
    fireEvent.change(inputs[1], {
      target: { files: [new File(['Name\nAda Lovelace\n'], 'second.csv', { type: 'text/csv' })] },
    });
    await waitFor(() => expect(state()[1].competitors).toHaveLength(1));

    fireEvent.click(screen.getAllByRole('button', { name: i18n.t('common.remove') })[0]);

    expect(state()).toHaveLength(1);
    expect(state()[0].name).toBe('Second');
    expect(screen.getByText('second.csv')).toBeTruthy();
  });

  it('ignores a cancelled file picker', () => {
    const { container } = mount([event()]);
    fireEvent.change(csvInput(container), { target: { files: [] } });
    expect(state()[0].competitors).toBeUndefined();
  });
});
