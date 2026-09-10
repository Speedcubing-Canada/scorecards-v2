// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, screen } from '@testing-library/react';
import i18n from '../i18n/index';
import { renderWithProviders, useEnglish } from '../test/render';
import LoginPage from './LoginPage';

// Mount smoke test: the sign-in screen is the one page every organizer sees, and
// it is the only one no other test touches. Assertions go through i18n keys, never
// literal copy, so rewording never reddens CI.

beforeEach(useEnglish);
afterEach(cleanup);

describe('LoginPage', () => {
  it('renders the sign-in screen', () => {
    renderWithProviders(<LoginPage />);
    expect(screen.getByRole('heading', { name: i18n.t('common.app_title') })).toBeTruthy();
    expect(screen.getByRole('button', { name: i18n.t('login.sign_in_button') })).toBeTruthy();
  });
});
