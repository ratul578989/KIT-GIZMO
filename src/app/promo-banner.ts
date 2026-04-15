import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-promo-banner',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="bg-[#020617] border-b border-[#22D3EE]/20 overflow-hidden h-[37px] flex items-center relative z-[60]">
      <a routerLink="/dashboard" [queryParams]="{section: 'add-funds'}" class="block whitespace-nowrap animate-marquee hover:pause">
        <span class="inline-block px-4 text-sm font-bold text-white tracking-wide">
          🔥 Deposit <span class="text-yellow-400 glow-yellow">$50</span> and get a Professional Shopify E-commerce Website for <span class="text-emerald-400 glow-green">FREE</span> (Full Setup + Payment Gateway)!
        </span>
        <span class="inline-block px-4 text-sm font-bold text-white tracking-wide">
          🔥 Deposit <span class="text-yellow-400 glow-yellow">$50</span> and get a Professional Shopify E-commerce Website for <span class="text-emerald-400 glow-green">FREE</span> (Full Setup + Payment Gateway)!
        </span>
        <span class="inline-block px-4 text-sm font-bold text-white tracking-wide">
          🔥 Deposit <span class="text-yellow-400 glow-yellow">$50</span> and get a Professional Shopify E-commerce Website for <span class="text-emerald-400 glow-green">FREE</span> (Full Setup + Payment Gateway)!
        </span>
        <span class="inline-block px-4 text-sm font-bold text-white tracking-wide">
          🔥 Deposit <span class="text-yellow-400 glow-yellow">$50</span> and get a Professional Shopify E-commerce Website for <span class="text-emerald-400 glow-green">FREE</span> (Full Setup + Payment Gateway)!
        </span>
      </a>
    </div>
  `,
  styles: [`
    .hover:pause:hover {
      animation-play-state: paused;
    }
  `]
})
export class PromoBannerComponent {}
