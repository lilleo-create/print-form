import { readFileSync } from 'node:fs';
import { act, render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { CdekWidgetPage } from './CdekWidgetPage';

const cdekUrl = 'https://cdn.jsdelivr.net/npm/@cdek-it/widget@3';
const payoutUrl = 'https://yookassa.ru/payouts-data/3.1.0/widget.js';

afterEach(() => {
  document.querySelector(`script[src="${cdekUrl}"]`)?.remove();
  delete window.CDEKWidget;
});

describe('page-level third-party scripts', () => {
  it('keeps neither CDEK nor YooKassa global in the app bootstrap', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toContain(`<script src="${cdekUrl}"`);
    expect(html).not.toContain(`<script src="${payoutUrl}"`);
    expect(html).toContain('https://challenges.cloudflare.com/turnstile/v0/api.js');
  });

  it('loads CDEK only on the widget page and reuses the loaded script', async () => {
    expect(document.querySelector(`script[src="${cdekUrl}"]`)).toBeNull();
    let widgets = 0;
    const mount = () => render(<MemoryRouter><CdekWidgetPage /></MemoryRouter>);
    const first = mount();
    const script = await waitFor(() => {
      const element = document.querySelector<HTMLScriptElement>(`script[src="${cdekUrl}"]`);
      expect(element).not.toBeNull();
      return element!;
    });
    window.CDEKWidget = class { constructor() { widgets += 1; } };
    await act(async () => { script.dispatchEvent(new Event('load')); });
    await waitFor(() => expect(widgets).toBe(1));
    first.unmount();
    const second = mount();
    await waitFor(() => expect(widgets).toBe(2));
    expect(document.querySelectorAll(`script[src="${cdekUrl}"]`)).toHaveLength(1);
    second.unmount();
  });
});
