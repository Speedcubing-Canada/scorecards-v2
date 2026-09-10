// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import i18n from '../i18n/index';
import { markAllSeen } from '../changelog';
import { readCompetition, readCustomEvents, readIsCustom } from '../lib/flowState';
import { renderWithProviders, useEnglish } from '../test/render';
import CustomCompetitionPage from './CustomCompetitionPage';

// The non-WCA branch of the wizard: there is no WCIF, so what the organizer types here is
// the only source for the scorecards. Assertions go through i18n keys, never literal copy.

beforeEach(async () => {
  sessionStorage.clear();
  localStorage.clear();
  markAllSeen();
  await useEnglish();
});
afterEach(cleanup);

// The name input is labelled by a heading, not a <label>, so the placeholder is the handle.
const nameBox = () => screen.getByPlaceholderText(i18n.t('custom.name_placeholder'));
const continueButton = () => screen.getByRole('button', { name: i18n.t('custom.continue') });

describe('CustomCompetitionPage', () => {
  it('renders the builder with continue disabled', () => {
    renderWithProviders(<CustomCompetitionPage />);
    expect(nameBox()).toBeTruthy();
    expect((continueButton() as HTMLButtonElement).disabled).toBe(true);
  });

  it('stays disabled until an event is actually named', () => {
    renderWithProviders(<CustomCompetitionPage />);
    fireEvent.change(nameBox(), { target: { value: 'Club Night' } });
    // A name alone produces no scorecards; continuing would reach /generate with nothing.
    expect((continueButton() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: i18n.t('settings.advanced.add_custom_event') }));
    expect((continueButton() as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(
      screen.getByPlaceholderText(i18n.t('settings.advanced.event_name_placeholder')),
      { target: { value: 'Mystery Puzzle' } },
    );
    expect((continueButton() as HTMLButtonElement).disabled).toBe(false);
  });

  it('hands the events to the next step and marks the flow custom', () => {
    renderWithProviders(<CustomCompetitionPage />);
    fireEvent.change(nameBox(), { target: { value: 'Club Night' } });
    fireEvent.click(screen.getByRole('button', { name: i18n.t('settings.advanced.add_custom_event') }));
    fireEvent.change(
      screen.getByPlaceholderText(i18n.t('settings.advanced.event_name_placeholder')),
      { target: { value: 'Mystery Puzzle' } },
    );
    fireEvent.click(continueButton());

    expect(readIsCustom()).toBe(true);
    expect(readCompetition().name).toBe('Club Night');
    expect(readCustomEvents().map(e => e.name)).toEqual(['Mystery Puzzle']);
  });

  it('drops an event left unnamed rather than printing a blank one', () => {
    renderWithProviders(<CustomCompetitionPage />);
    fireEvent.change(nameBox(), { target: { value: 'Club Night' } });
    const add = screen.getByRole('button', { name: i18n.t('settings.advanced.add_custom_event') });
    fireEvent.click(add);
    fireEvent.click(add);

    const [first] = screen.getAllByPlaceholderText(i18n.t('settings.advanced.event_name_placeholder'));
    fireEvent.change(first, { target: { value: 'Mystery Puzzle' } });
    fireEvent.click(continueButton());

    expect(readCustomEvents().map(e => e.name)).toEqual(['Mystery Puzzle']);
  });

  it('restores a name entered before back-navigation', () => {
    renderWithProviders(<CustomCompetitionPage />);
    fireEvent.change(nameBox(), { target: { value: 'Club Night' } });
    expect((nameBox() as HTMLInputElement).value).toBe('Club Night');
    // Nothing is persisted until Continue: an abandoned draft must not leak into a WCA flow.
    expect(readIsCustom()).toBe(false);
    expect(readCompetition().id).toBe('');
    expect(readCustomEvents()).toEqual([]);
  });
});
