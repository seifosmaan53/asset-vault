import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as puppeteer from 'puppeteer';
import { Browser, Page } from 'puppeteer';
import * as os from 'os';

@Injectable()
export class PuppeteerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PuppeteerService.name);
  private browser: Browser | null = null;
  private readonly maxConcurrentPages = 5;
  private activePages = 0;
  private browserLaunchPromise: Promise<void> | null = null;
  private isShuttingDown = false;
  private readonly launchOptions: puppeteer.LaunchOptions = {
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu',
      '--disable-web-security',
      '--disable-features=IsolateOrigins,site-per-process',
      '--disable-background-timer-throttling',
      '--disable-backgrounding-occluded-windows',
      '--disable-renderer-backgrounding',
    ],
  };

  constructor() {
    // Check architecture mismatch early, before any browser operations
    this.checkArchitectureMismatch();
  }

  private checkArchitectureMismatch(): void {
    const nodeArch = process.arch;
    const platform = process.platform;
    const cpuModel = os.cpus()[0]?.model || '';

    // Check if running x64 Node.js on Apple Silicon Mac (Rosetta translation)
    // Apple Silicon CPUs have "Apple" in their model name
    const isAppleSilicon = cpuModel.includes('Apple');
    const isRosettaMode = platform === 'darwin' && nodeArch === 'x64' && isAppleSilicon;

    if (isRosettaMode) {
      // Use error level to make it more visible, and log it multiple times for visibility
      this.logger.error(
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        '⚠️  ARCHITECTURE MISMATCH DETECTED\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n' +
        'You are running x64 Node.js on Mac Silicon (arm64), which causes Rosetta translation.\n' +
        'This results in degraded Puppeteer performance.\n' +
        '\n' +
        'RECOMMENDED FIX:\n' +
        '  1. Install arm64 Node.js using Homebrew:\n' +
        '     arch -arm64 brew install node\n' +
        '  2. Or download arm64 Node.js from: https://nodejs.org/\n' +
        '  3. Verify with: node -p "process.arch" (should show "arm64")\n' +
        '\n' +
        'NOTE: You will see a Puppeteer warning below - this is expected and will disappear\n' +
        '      once you install arm64 Node.js. The application will continue to work but\n' +
        '      may be slower until you fix this.\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      );
    }
  }

  async onModuleInit(): Promise<void> {
    // Pre-warm the browser on startup to avoid first request delay
    // Note: This helps but on Mac Silicon (arm64) with x64 Node.js,
    // browser launch will still be slower due to Rosetta translation.
    // For best performance, use arm64 Node.js.
    // If pre-warm fails, it's not critical - browser will launch on first PDF request
    // Bug #86: Enhanced error logging with full error details
    this.browserLaunchPromise = this.launchBrowser().catch((error) => {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      
      this.logger.warn(
        `Failed to pre-warm browser (non-critical - will launch on first PDF request): ${errorMessage}`,
      );
      // Bug #86: Log full error details including stack trace and error name
      this.logger.error('Puppeteer pre-warm error details:', {
        name: errorName,
        message: errorMessage,
        stack: errorStack,
        error: error,
      });
      this.browserLaunchPromise = null;
    });
  }

  async getPage(): Promise<Page> {
    // Wait for browser launch if in progress
    if (this.browserLaunchPromise) {
      try {
        await this.browserLaunchPromise;
      } catch (error) {
        // Pre-warm failed, try launching now
        this.logger.debug('Pre-warm failed, launching browser on demand');
      }
      this.browserLaunchPromise = null;
    }

    if (!this.browser || !this.browser.isConnected()) {
      try {
        await this.launchBrowser();
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        this.logger.error(`Critical: Failed to launch browser for PDF generation: ${errorMessage}`);
        throw new Error(
          `Puppeteer browser launch failed: ${errorMessage}. PDF generation unavailable. ` +
          `Please check Puppeteer installation and browser dependencies.`,
        );
      }
    }

    // Wait if we have too many active pages
    while (this.activePages >= this.maxConcurrentPages) {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    this.activePages++;
    try {
      const page = await this.browser!.newPage();
      return page;
    } catch (error) {
      this.activePages--;
      throw error;
    }
  }

  async closePage(page: Page): Promise<void> {
    try {
      if (!page.isClosed()) {
        await page.close();
      }
    } catch (error) {
      this.logger.warn('Error closing page:', error);
    } finally {
      this.activePages = Math.max(0, this.activePages - 1);
    }
  }

  private async launchBrowser(): Promise<void> {
    try {
      if (this.browser) {
        await this.browser.close();
      }

      this.logger.log('Launching Puppeteer browser...');
      this.browser = await puppeteer.launch(this.launchOptions);
      this.logger.log('Puppeteer browser launched successfully');

      // Handle browser disconnection
      this.browser.on('disconnected', () => {
        // Only log warning if it's an unexpected disconnect (not during shutdown)
        if (!this.isShuttingDown) {
          this.logger.warn('Browser disconnected unexpectedly - will relaunch on next request');
        } else {
          this.logger.debug('Browser disconnected (expected during shutdown)');
        }
        this.browser = null;
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      // Log as error but don't throw during pre-warm (onModuleInit handles it)
      // Only throw if called from getPage() where we actually need the browser
      this.logger.error(`Failed to launch browser: ${errorMessage}`);
      if (error instanceof Error && error.stack) {
        this.logger.debug('Browser launch error stack:', error.stack);
      }
      throw error;
    }
  }

  async onModuleDestroy(): Promise<void> {
    this.isShuttingDown = true;
    
    // Wait for any active pages to finish before closing browser
    if (this.activePages > 0) {
      this.logger.log(`Waiting for ${this.activePages} active page(s) to finish...`);
      let waitCount = 0;
      const maxWait = 30; // Wait up to 3 seconds (30 * 100ms)
      
      while (this.activePages > 0 && waitCount < maxWait) {
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitCount++;
      }
      
      if (this.activePages > 0) {
        this.logger.warn(`Force closing browser with ${this.activePages} active page(s) still open`);
      }
    }
    
    if (this.browser) {
      this.logger.log('Closing Puppeteer browser...');
      try {
        // Get all pages and close them
        const pages = await this.browser.pages();
        await Promise.allSettled(pages.map(page => page.close().catch(() => {
          // Ignore errors closing individual pages
        })));
        
        await this.browser.close();
        this.logger.log('Puppeteer browser closed successfully');
      } catch (error) {
        // Browser may already be closed/disconnected
        this.logger.debug('Browser already closed or disconnected during shutdown');
      } finally {
        this.browser = null;
        this.activePages = 0;
      }
    }
  }

  async generatePdfFromHtml(html: string, options?: puppeteer.PDFOptions): Promise<Buffer> {
    const page = await this.getPage();
    
    try {
      // Use 'domcontentloaded' for faster rendering - CSS will still be applied
      // This is faster than 'load' since we don't wait for all resources
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm',
        },
        ...options,
      });

      // Convert Uint8Array to Buffer
      return Buffer.from(pdfBuffer as Uint8Array);
    } finally {
      await this.closePage(page);
    }
  }
}

