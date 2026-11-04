import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PLUGIN_ZIP_URL, PluginDownload, SISENSE_ADD_ONS_DOCS_URL } from './PluginDownload';

describe('PluginDownload', () => {
  it('links to the plugin zip as a download', () => {
    render(<PluginDownload />);

    const link = screen.getByRole('link', { name: 'Download plugin (.zip)' });
    expect(link).toHaveAttribute('href', PLUGIN_ZIP_URL);
    expect(link).toHaveAttribute('download');
  });

  it("links to Sisense's add-ons documentation in a new tab", () => {
    render(<PluginDownload />);

    const link = screen.getByRole('link', { name: 'How to install Sisense add-ons' });
    expect(link).toHaveAttribute('href', SISENSE_ADD_ONS_DOCS_URL);
    expect(link).toHaveAttribute('target', '_blank');
  });
});
