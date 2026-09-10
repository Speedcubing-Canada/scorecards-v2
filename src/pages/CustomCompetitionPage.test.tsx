// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import i18n from '../i18n/index';
import { markAllSeen } from '../changelog';
import { readCompetition, readCustomEvents, readIsCustom } from '../lib/flowState';
import { renderWithProviders, useEnglish } from '../test/render';
import CustomCompetitionPage from './CustomCompetitionPage';

// Mount smoke test. Assertions go through i18n keys, never literal copy.

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
