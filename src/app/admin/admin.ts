import { Component, inject, signal, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { auth, db } from '../../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, doc, updateDoc, increment, runTransaction, Timestamp, serverTimestamp, getDoc, getDocs } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

interface User {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  balance: number;
  totalSpent?: number;
  lastLogin?: Timestamp;
  lastActive?: Timestamp;
  createdAt: Timestamp;
}

interface Order {
  id: string;
  userId: string;
  userEmail: string;
  category: string;
  service: string;
  link: string;
  quantity: number;
  charge: number;
  status: string;
  createdAt: Timestamp;
}

interface Deposit {
  id: string;
  userId: string;
  userEmail: string;
  amount: number;
  methodName: string;
  transactionId: string;
  status: string;
  createdAt: Timestamp;
}

interface Ticket {
  id: string;
  userId: string;
  userEmail: string;
  subject: string;
  message: string;
  imageUrl?: string;
  status: string;
  replies: { sender: string, message: string, imageUrl?: string, timestamp: Timestamp }[];
  createdAt: Timestamp;
}

interface PaymentMethod {
  id: string;
  name: string;
  address: string;
  instructions: string;
  isActive: boolean;
  createdAt: Timestamp;
}

interface Marketplace {
  id: string;
  name: string;
  logoUrl: string;
  redirectUrl: string;
  isActive: boolean;
  order: number;
  createdAt: Timestamp;
}

interface SiteSettings {
  instagramUrl: string;
  showInstagramCard: boolean;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[#020617] text-white font-sans flex flex-col md:flex-row">
      <!-- Sidebar -->
      <aside class="w-full md:w-72 border-r border-white/10 flex flex-col bg-[#0B1120]">
        <div class="p-6 text-2xl font-bold tracking-tighter border-b border-white/10 text-[#22D3EE]">ADMIN PANEL</div>
        
        <nav class="flex-1 p-4 space-y-2">
          <button 
            (click)="currentSection.set('users')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'users' ? 'bg-[#22D3EE] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>people</mat-icon>
            User Management
          </button>
          <button 
            (click)="currentSection.set('deposits')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'deposits' ? 'bg-[#22D3EE] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>account_balance_wallet</mat-icon>
            Manage Deposits
          </button>
          <button 
            (click)="currentSection.set('orders')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'orders' ? 'bg-[#22D3EE] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>shopping_cart</mat-icon>
            Manage Orders
          </button>
          <button 
            (click)="currentSection.set('tickets')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'tickets' ? 'bg-[#22D3EE] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>confirmation_number</mat-icon>
            Admin Tickets
          </button>
          <button 
            (click)="currentSection.set('payment-methods')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'payment-methods' ? 'bg-[#22D3EE] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>payments</mat-icon>
            Payment Methods
          </button>
          <button 
            (click)="currentSection.set('marketplaces')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'marketplaces' ? 'bg-[#22D3EE] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>storefront</mat-icon>
            Manage Marketplaces
          </button>
          <button 
            (click)="currentSection.set('site-settings')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'site-settings' ? 'bg-[#22D3EE] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>settings</mat-icon>
            Site Settings
          </button>
          
          <div class="pt-4 mt-4 border-t border-white/10">
            <a routerLink="/dashboard" class="flex items-center gap-3 p-3 text-gray-400 hover:bg-white/5 hover:text-white rounded-xl transition-all">
              <mat-icon>arrow_back</mat-icon>
              User Dashboard
            </a>
          </div>
        </nav>

        <div class="p-4 border-t border-white/10">
          <button (click)="logout()" class="w-full flex items-center gap-3 p-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all">
            <mat-icon>logout</mat-icon>
            Logout
          </button>
        </div>
      </aside>

      <!-- Main Content -->
      <main class="flex-1 overflow-y-auto p-6 md:p-8">
        <header class="mb-8 flex justify-between items-center">
          <h1 class="text-2xl font-bold capitalize text-white">{{ currentSection().replace('-', ' ') }}</h1>
        </header>

        <!-- Users Section -->
        @if (currentSection() === 'users') {
          <!-- Admin Insights -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div class="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <div class="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Total Registered Users</div>
              <div class="text-3xl font-bold text-[#22D3EE]">{{ adminStats().totalUsers }}</div>
            </div>
            <div class="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <div class="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">Active Today</div>
              <div class="text-3xl font-bold text-emerald-400">{{ adminStats().activeToday }}</div>
            </div>
            <div class="bg-white/5 border border-white/10 p-6 rounded-2xl">
              <div class="text-gray-500 text-xs font-bold uppercase tracking-widest mb-2">New Signups (Today)</div>
              <div class="text-3xl font-bold text-amber-400">{{ adminStats().newSignupsToday }}</div>
            </div>
          </div>

          <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="text-gray-500 text-xs font-bold uppercase tracking-widest border-b border-white/10">
                    <th class="p-6">User</th>
                    <th class="p-6">Status</th>
                    <th class="p-6">Last Login</th>
                    <th class="p-6">Balance</th>
                    <th class="p-6">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/10">
                  @for (user of users(); track user.uid) {
                    <tr class="hover:bg-white/5 transition-colors group">
                      <td class="p-6">
                        <div class="font-medium text-white">{{ user.fullName }}</div>
                        <div class="text-xs text-gray-500">{{ user.email }}</div>
                      </td>
                      <td class="p-6">
                        <div class="flex items-center gap-2">
                          <div [class]="'w-2 h-2 rounded-full ' + (isOnline(user) ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]' : 'bg-gray-500')"></div>
                          <span [class]="'text-xs font-medium ' + (isOnline(user) ? 'text-emerald-400' : 'text-gray-500')">
                            {{ isOnline(user) ? 'Online' : 'Offline' }}
                          </span>
                        </div>
                      </td>
                      <td class="p-6 text-gray-500 text-sm">
                        {{ user.lastLogin ? (user.lastLogin.toDate() | date:'dd MMM, yyyy - hh:mm a') : 'Never' }}
                      </td>
                      <td class="p-6 font-bold text-[#22D3EE]">{{ user.balance | number:'1.2-2' }}</td>
                      <td class="p-6">
                        <button (click)="viewUser(user)" class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-xs font-bold hover:bg-[#22D3EE] hover:text-[#020617] transition-all">
                          View
                        </button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- User Detail Modal -->
        @if (selectedUser()) {
          <div class="fixed inset-0 z-[110] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4" (click)="selectedUser.set(null)" (keydown.escape)="selectedUser.set(null)" tabindex="0">
            <div class="bg-[#020617] border border-white/10 w-full max-w-2xl rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in duration-300" (click)="$event.stopPropagation()" (keydown)="$event.stopPropagation()" tabindex="0">
              <div class="p-8 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                <div>
                  <h2 class="text-2xl font-bold text-white">{{ selectedUser()?.fullName }}</h2>
                  <p class="text-gray-500 text-sm">{{ selectedUser()?.email }}</p>
                </div>
                <button (click)="selectedUser.set(null)" class="p-2 hover:bg-white/5 rounded-full transition-all text-gray-400">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
              
              <div class="p-8 space-y-8">
                <div class="grid grid-cols-2 gap-8">
                  <div class="space-y-1">
                    <div class="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Registration Date</div>
                    <div class="text-lg font-medium text-white">{{ selectedUser()?.createdAt?.toDate() | date:'dd MMMM, yyyy - hh:mm a' }}</div>
                  </div>
                  <div class="space-y-1">
                    <div class="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Total Spent</div>
                    <div class="text-lg font-bold text-[#22D3EE]">$ {{ (selectedUser()?.totalSpent || 0) | number:'1.2-2' }}</div>
                  </div>
                </div>

                <div class="space-y-4">
                  <div class="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Recent Activity Log</div>
                  <div class="space-y-3 max-h-64 overflow-y-auto pr-2 custom-scrollbar">
                    @for (order of userOrders(selectedUser()!.uid); track order.id) {
                      <div class="bg-white/5 border border-white/10 p-4 rounded-xl flex items-center justify-between">
                        <div>
                          <div class="text-sm font-medium text-white">{{ order.service }}</div>
                          <div class="text-[10px] text-gray-500">{{ order.createdAt?.toDate() | date:'medium' }}</div>
                        </div>
                        <div class="text-right">
                          <div class="text-sm font-bold text-[#22D3EE]">- $ {{ order.charge | number:'1.2-2' }}</div>
                          <div class="text-[10px] uppercase font-bold text-gray-500">{{ order.status }}</div>
                        </div>
                      </div>
                    }
                    @if (userOrders(selectedUser()!.uid).length === 0) {
                      <div class="text-center py-8 text-gray-500 text-sm italic">No recent activity found.</div>
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>
        }

        <!-- Deposits Section -->
        @if (currentSection() === 'deposits') {
          <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="text-gray-500 text-xs font-bold uppercase tracking-widest border-b border-white/10">
                    <th class="p-6">User</th>
                    <th class="p-6">Method</th>
                    <th class="p-6">Amount</th>
                    <th class="p-6">Transaction ID</th>
                    <th class="p-6">Status</th>
                    <th class="p-6">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/10">
                  @for (dep of deposits(); track dep.id) {
                    <tr class="hover:bg-white/5 transition-colors">
                      <td class="p-6">
                        <div class="text-sm text-white">{{ dep.userEmail }}</div>
                        <div class="text-[10px] text-gray-500">{{ dep.createdAt?.toDate() | date:'short' }}</div>
                      </td>
                      <td class="p-6 text-xs text-gray-500">{{ dep.methodName || 'USDT TRC20' }}</td>
                      <td class="p-6 font-bold text-[#22D3EE]">{{ dep.amount | number:'1.2-2' }}</td>
                      <td class="p-6 text-xs font-mono text-gray-500">{{ dep.transactionId }}</td>
                      <td class="p-6">
                        <span [class]="'px-2 py-1 rounded text-[10px] font-bold uppercase ' + 
                          (dep.status === 'approved' ? 'bg-emerald-500/10 text-emerald-400' : 
                           dep.status === 'rejected' ? 'bg-red-500/10 text-red-400' : 
                           'bg-amber-500/10 text-amber-400')">
                          {{ dep.status }}
                        </span>
                      </td>
                      <td class="p-6">
                        @if (dep.status === 'pending') {
                          <div class="flex gap-2">
                            <button (click)="handleDeposit(dep, 'approved')" class="p-2 bg-emerald-500/20 text-emerald-400 rounded hover:bg-emerald-500/30 transition-all">
                              <mat-icon>check</mat-icon>
                            </button>
                            <button (click)="handleDeposit(dep, 'rejected')" class="p-2 bg-red-500/20 text-red-400 rounded hover:bg-red-500/30 transition-all">
                              <mat-icon>close</mat-icon>
                            </button>
                          </div>
                        }
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Orders Section -->
        @if (currentSection() === 'orders') {
          <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="text-gray-500 text-xs font-bold uppercase tracking-widest border-b border-white/10">
                    <th class="p-6">Order</th>
                    <th class="p-6">User</th>
                    <th class="p-6">Status</th>
                    <th class="p-6">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/10">
                  @for (order of orders(); track order.id) {
                    <tr class="hover:bg-white/5 transition-colors">
                      <td class="p-6">
                        <div class="font-medium text-white">{{ order.service }}</div>
                        <div class="text-xs text-gray-500">{{ order.quantity | number }} units - {{ order.charge | number:'1.2-2' }}</div>
                      </td>
                      <td class="p-6 text-sm text-gray-500">{{ order.userEmail }}</td>
                      <td class="p-6">
                        <span [class]="'px-3 py-1 rounded-full text-[10px] font-bold uppercase ' + 
                          (order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
                           order.status === 'pending' ? 'bg-amber-500/10 text-amber-400' : 
                           order.status === 'processing' ? 'bg-blue-500/10 text-blue-400' :
                           'bg-red-500/10 text-red-400')">
                          {{ order.status }}
                        </span>
                      </td>
                      <td class="p-6">
                        <select 
                          (change)="updateOrderStatus(order.id, $any($event.target).value)"
                          class="bg-white/5 border border-white/10 text-white rounded-xl p-2 text-xs outline-none focus:border-[#22D3EE] cursor-pointer"
                        >
                          <option value="" disabled selected class="bg-[#0B1120]">Update Status</option>
                          <option value="pending" class="bg-[#0B1120]">Pending</option>
                          <option value="processing" class="bg-[#0B1120]">Processing</option>
                          <option value="completed" class="bg-[#0B1120]">Completed</option>
                          <option value="cancelled" class="bg-[#0B1120]">Cancelled</option>
                          <option value="refunded" class="bg-[#0B1120]">Refunded</option>
                        </select>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Tickets Section -->
        @if (currentSection() === 'tickets') {
          <div class="space-y-6">
            @for (ticket of tickets(); track ticket.id) {
              <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
                <div class="p-6 border-b border-white/10 flex justify-between items-center bg-white/[0.02]">
                  <div>
                    <h3 class="text-lg font-bold text-[#22D3EE]">{{ ticket.subject }}</h3>
                    <p class="text-xs text-gray-500">From: {{ ticket.userEmail }} • {{ ticket.createdAt?.toDate() | date:'medium' }}</p>
                  </div>
                  <span [class]="'px-3 py-1 rounded-full text-[10px] font-bold uppercase ' + (ticket.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400')">
                    {{ ticket.status }}
                  </span>
                </div>
                
                <div class="p-6 space-y-6">
                  <!-- User Initial Message -->
                  <div class="flex gap-4">
                    <div class="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center shrink-0 border border-white/10">
                      <mat-icon class="text-gray-500">person</mat-icon>
                    </div>
                    <div class="space-y-2 flex-1">
                      <div class="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/10 text-sm leading-relaxed text-white">
                        {{ ticket.message }}
                        @if (ticket.imageUrl) {
                          <div class="mt-4">
                            <img [src]="ticket.imageUrl" alt="Ticket attachment" class="max-w-xs rounded-xl border border-white/10 cursor-pointer hover:opacity-80 transition-opacity shadow-lg" (click)="selectedImage.set(ticket.imageUrl)" (keydown.enter)="selectedImage.set(ticket.imageUrl)" tabindex="0" referrerpolicy="no-referrer">
                            <p class="text-[10px] text-gray-500 mt-1 italic">Click to enlarge</p>
                          </div>
                        }
                      </div>
                    </div>
                  </div>

                  <!-- Conversation -->
                  @for (reply of ticket.replies; track reply.timestamp) {
                    <div [class]="'flex gap-4 ' + (reply.sender === 'admin' ? 'flex-row-reverse' : '')">
                      <div [class]="'w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ' + (reply.sender === 'admin' ? 'bg-[#22D3EE] text-[#020617] border-[#22D3EE]' : 'bg-white/5 text-gray-500 border-white/10')">
                        <mat-icon>{{ reply.sender === 'admin' ? 'support_agent' : 'person' }}</mat-icon>
                      </div>
                      <div [class]="'space-y-2 flex-1 ' + (reply.sender === 'admin' ? 'text-right' : '')">
                        <div [class]="'inline-block p-4 rounded-2xl border text-sm leading-relaxed ' + 
                          (reply.sender === 'admin' ? 'bg-[#22D3EE]/10 border-[#22D3EE]/20 rounded-tr-none text-left text-white' : 'bg-white/5 border-white/10 rounded-tl-none text-white')">
                          {{ reply.message }}
                          @if (reply.imageUrl) {
                            <div class="mt-4">
                              <img [src]="reply.imageUrl" alt="Reply attachment" class="max-w-xs rounded-xl border border-white/10 cursor-pointer hover:opacity-80 transition-opacity shadow-lg" (click)="selectedImage.set(reply.imageUrl)" (keydown.enter)="selectedImage.set(reply.imageUrl)" tabindex="0" referrerpolicy="no-referrer">
                              <p class="text-[10px] text-gray-500 mt-1 italic">Click to enlarge</p>
                            </div>
                          }
                        </div>
                        <div class="text-[9px] text-gray-500 uppercase tracking-widest mt-1">{{ reply.timestamp.toDate() | date:'shortTime' }}</div>
                      </div>
                    </div>
                  }

                  <!-- Admin Reply Form -->
                  @if (ticket.status === 'open') {
                    <div class="pt-6 border-t border-white/10 space-y-4">
                      <div class="flex gap-4 items-end">
                        <div class="flex-1 space-y-2">
                          <textarea 
                            #replyMsg
                            (input)="replyMessage.set(replyMsg.value)"
                            [value]="replyMessage()"
                            rows="2"
                            placeholder="Type your response..."
                            class="w-full bg-white/5 border border-white/10 text-white rounded-xl py-3 px-4 focus:border-[#22D3EE] outline-none transition-all resize-none text-sm"
                          ></textarea>
                        </div>
                        
                        <div class="flex gap-2">
                          <label class="cursor-pointer">
                            <input type="file" class="hidden" (change)="onFileSelected($event)" accept="image/*">
                            <div class="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group">
                              <mat-icon class="text-gray-500 group-hover:text-[#22D3EE]">add_a_photo</mat-icon>
                            </div>
                          </label>
                          <button 
                            (click)="replyToTicket(ticket.id)"
                            [disabled]="isReplying() || !replyMessage().trim()"
                            class="px-6 py-3 bg-[#22D3EE] text-[#020617] rounded-xl hover:bg-[#22D3EE]/90 transition-all disabled:opacity-50 font-bold flex items-center gap-2"
                          >
                            <mat-icon class="text-sm">send</mat-icon>
                            Send
                          </button>
                          <button 
                            (click)="closeTicket(ticket.id)"
                            class="px-4 py-3 bg-red-500/10 text-red-400 border border-red-500/20 rounded-xl font-bold text-sm hover:bg-red-500/20 transition-all"
                          >
                            Close
                          </button>
                        </div>
                      </div>

                      @if (filePreview()) {
                        <div class="relative w-20 h-20 rounded-xl overflow-hidden border border-[#22D3EE]/30 group">
                          <img [src]="filePreview()" alt="File preview" class="w-full h-full object-cover" referrerpolicy="no-referrer">
                          <button (click)="selectedFile.set(null); filePreview.set(null)" class="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                            <mat-icon class="text-xs">close</mat-icon>
                          </button>
                        </div>
                      }
                    </div>
                  }
                </div>
              </div>
            } @empty {
              <div class="p-12 text-center text-gray-500 bg-white/5 border border-white/10 rounded-2xl">
                No support tickets found.
              </div>
            }
          </div>
      }

      <!-- Image Lightbox -->
      @if (selectedImage()) {
        <div class="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 md:p-12 animate-in fade-in duration-300" (click)="selectedImage.set(null)" (keydown.escape)="selectedImage.set(null)" tabindex="0">
          <button (click)="selectedImage.set(null)" class="absolute top-8 right-8 text-white hover:text-[#22D3EE] transition-colors">
            <mat-icon class="text-4xl">close</mat-icon>
          </button>
          <img [src]="selectedImage()" alt="Enlarged attachment" class="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in duration-300" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" referrerpolicy="no-referrer">
        </div>
      }

        <!-- Payment Methods Section -->
        @if (currentSection() === 'payment-methods') {
          <div class="space-y-8">
            <!-- Add New Method Form -->
            <div class="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6 shadow-lg">
              <h2 class="text-xl font-bold text-white">Add New Payment Method</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label for="method-name" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Method Name</label>
                  <input id="method-name" [(ngModel)]="newMethod.name" type="text" placeholder="e.g. USDT TRC20" class="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-[#22D3EE]">
                </div>
                <div class="space-y-2">
                  <label for="wallet-address" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Wallet Address</label>
                  <input id="wallet-address" [(ngModel)]="newMethod.address" type="text" placeholder="Enter wallet address" class="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-[#22D3EE]">
                </div>
                <div class="space-y-2 md:col-span-2">
                  <label for="method-instr" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Instructions</label>
                  <input id="method-instr" [(ngModel)]="newMethod.instructions" type="text" placeholder="Specific instructions for user" class="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-[#22D3EE]">
                </div>
              </div>
              <button (click)="addPaymentMethod()" class="px-8 py-3 bg-[#22D3EE] text-[#020617] font-bold rounded-xl hover:bg-[#22D3EE]/90 transition-all shadow-lg shadow-[#22D3EE]/20">
                Add Payment Method
              </button>
            </div>

            <!-- List of Methods -->
            <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
              <div class="overflow-x-auto">
                <table class="w-full text-left">
                  <thead>
                    <tr class="text-gray-500 text-xs font-bold uppercase tracking-widest border-b border-white/10">
                      <th class="p-6">Method</th>
                      <th class="p-6">Address</th>
                      <th class="p-6">Status</th>
                      <th class="p-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/10">
                    @for (method of paymentMethods(); track method.id) {
                      <tr class="hover:bg-white/5 transition-colors">
                        <td class="p-6 font-medium text-white">{{ method.name }}</td>
                        <td class="p-6 text-xs font-mono text-gray-500">{{ method.address }}</td>
                        <td class="p-6">
                          <button (click)="toggleMethodStatus(method)" [class]="'px-3 py-1 rounded-full text-[10px] font-bold uppercase ' + (method.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')">
                            {{ method.isActive ? 'Active' : 'Disabled' }}
                          </button>
                        </td>
                        <td class="p-6">
                          <div class="flex gap-2">
                            <button (click)="deletePaymentMethod(method.id)" class="p-2 text-red-400 hover:bg-red-500/10 rounded transition-all">
                              <mat-icon>delete</mat-icon>
                            </button>
                          </div>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }
        <!-- Site Settings Section -->
        @if (currentSection() === 'site-settings') {
          <div class="max-w-2xl space-y-8">
            <div class="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-8 shadow-lg">
              <div class="flex items-center gap-3 mb-2">
                <i class="fab fa-instagram text-2xl text-[#22D3EE]"></i>
                <h2 class="text-xl font-bold text-white">Instagram Trust Section</h2>
              </div>

              <div class="space-y-6">
                <!-- Instagram URL -->
                <div class="space-y-2">
                  <label for="insta-url" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Instagram Profile URL</label>
                  <input 
                    id="insta-url" 
                    [(ngModel)]="siteSettings().instagramUrl" 
                    type="text" 
                    placeholder="https://instagram.com/yourprofile" 
                    class="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-[#22D3EE] transition-all"
                  >
                </div>

                <!-- Toggle Switch -->
                <div class="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/10">
                  <div>
                    <div class="text-sm font-bold text-white">Show Instagram Card on Dashboard</div>
                    <div class="text-xs text-gray-500">Enable or disable the Instagram trust section for users.</div>
                  </div>
                  <button 
                    (click)="toggleInstagramCard()"
                    [class]="'relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ' + (siteSettings().showInstagramCard ? 'bg-[#22D3EE]' : 'bg-gray-700')"
                  >
                    <span 
                      [class]="'inline-block h-4 w-4 transform rounded-full bg-white transition-transform ' + (siteSettings().showInstagramCard ? 'translate-x-6' : 'translate-x-1')"
                    ></span>
                  </button>
                </div>

                <div class="pt-4">
                  <button 
                    (click)="saveSiteSettings()" 
                    [disabled]="isSavingSettings()"
                    class="px-8 py-3 bg-[#22D3EE] text-[#020617] font-bold rounded-xl hover:bg-[#22D3EE]/90 transition-all flex items-center gap-2 shadow-lg shadow-[#22D3EE]/20"
                  >
                    <mat-icon class="text-sm">save</mat-icon>
                    {{ isSavingSettings() ? 'Saving...' : 'Save Settings' }}
                  </button>
                </div>
              </div>
            </div>

            @if (showSettingsToast()) {
              <div class="fixed bottom-8 right-8 bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-2">
                <mat-icon>check_circle</mat-icon>
                Settings updated successfully!
              </div>
            }
          </div>
        }

        <!-- Marketplaces Section -->
        @if (currentSection() === 'marketplaces') {
          <div class="space-y-8">
            <!-- Add/Edit Marketplace Form -->
            <div class="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6 shadow-lg">
              <h2 class="text-xl font-bold text-white">{{ editingMarketplace() ? 'Edit' : 'Add New' }} Marketplace</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label for="mp-name" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Marketplace Name</label>
                  <input id="mp-name" [(ngModel)]="marketplaceForm.name" type="text" placeholder="e.g. Amazon" class="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-[#22D3EE]">
                </div>
                <div class="space-y-2">
                  <label for="mp-url" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Redirect URL</label>
                  <input id="mp-url" [(ngModel)]="marketplaceForm.redirectUrl" type="text" placeholder="https://amazon.com" class="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-[#22D3EE]">
                </div>
                <div class="space-y-2">
                  <label for="mp-order" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Display Order</label>
                  <input id="mp-order" [(ngModel)]="marketplaceForm.order" type="number" class="w-full bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-[#22D3EE]">
                </div>
                <div class="space-y-2">
                  <label for="mp-logo" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Logo Image</label>
                  <div class="flex items-center gap-4">
                    <label class="cursor-pointer flex-1">
                      <input id="mp-logo" type="file" class="hidden" (change)="onLogoSelected($event)" accept="image/*">
                      <div class="w-full bg-white/5 border border-white/10 text-gray-400 rounded-xl px-4 py-3 hover:bg-white/10 transition-all flex items-center gap-2">
                        <mat-icon>upload_file</mat-icon>
                        {{ logoFile() ? logoFile()?.name : 'Choose Logo File' }}
                      </div>
                    </label>
                    @if (logoPreview() || marketplaceForm.logoUrl) {
                      <div class="w-12 h-12 rounded-lg bg-white/5 border border-white/10 p-2 flex items-center justify-center">
                        <img [src]="logoPreview() || marketplaceForm.logoUrl" alt="Preview" class="max-w-full max-h-full object-contain" referrerpolicy="no-referrer">
                      </div>
                    }
                  </div>
                </div>
              </div>
              <div class="flex gap-4">
                <button 
                  (click)="saveMarketplace()" 
                  [disabled]="isSavingMarketplace() || !marketplaceForm.name"
                  class="px-8 py-3 bg-[#22D3EE] text-[#020617] font-bold rounded-xl hover:bg-[#22D3EE]/90 transition-all shadow-lg shadow-[#22D3EE]/20 disabled:opacity-50"
                >
                  {{ isSavingMarketplace() ? 'Saving...' : (editingMarketplace() ? 'Update' : 'Add') + ' Marketplace' }}
                </button>
                @if (editingMarketplace()) {
                  <button (click)="cancelEditMarketplace()" class="px-8 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all">
                    Cancel
                  </button>
                }
              </div>
            </div>

            <!-- List of Marketplaces -->
            <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden shadow-lg">
              <div class="overflow-x-auto">
                <table class="w-full text-left">
                  <thead>
                    <tr class="text-gray-500 text-xs font-bold uppercase tracking-widest border-b border-white/10">
                      <th class="p-6">Logo</th>
                      <th class="p-6">Name</th>
                      <th class="p-6">Order</th>
                      <th class="p-6">Status</th>
                      <th class="p-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/10">
                    @for (mp of marketplaces(); track mp.id) {
                      <tr class="hover:bg-white/5 transition-colors">
                        <td class="p-6">
                          <div class="w-12 h-12 rounded-lg bg-white/5 border border-white/10 p-2 flex items-center justify-center">
                            <img [src]="mp.logoUrl" alt="Logo" class="max-w-full max-h-full object-contain" referrerpolicy="no-referrer">
                          </div>
                        </td>
                        <td class="p-6">
                          <div class="font-medium text-white">{{ mp.name }}</div>
                          <div class="text-xs text-gray-500">{{ mp.redirectUrl }}</div>
                        </td>
                        <td class="p-6 text-gray-400">{{ mp.order }}</td>
                        <td class="p-6">
                          <button (click)="toggleMarketplaceStatus(mp)" [class]="'px-3 py-1 rounded-full text-[10px] font-bold uppercase ' + (mp.isActive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')">
                            {{ mp.isActive ? 'Active' : 'Hidden' }}
                          </button>
                        </td>
                        <td class="p-6">
                          <div class="flex gap-2">
                            <button (click)="editMarketplace(mp)" class="p-2 text-[#22D3EE] hover:bg-[#22D3EE]/10 rounded transition-all">
                              <mat-icon>edit</mat-icon>
                            </button>
                            <button (click)="deleteMarketplace(mp.id)" class="p-2 text-red-400 hover:bg-red-500/10 rounded transition-all">
                              <mat-icon>delete</mat-icon>
                            </button>
                          </div>
                        </td>
                      </tr>
                    } @empty {
                      <tr>
                        <td colspan="5" class="p-12 text-center text-gray-500 italic">No marketplaces added yet.</td>
                      </tr>
                    }
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        }

        @if (showMarketplaceToast()) {
          <div class="fixed bottom-8 right-8 bg-emerald-500 text-white px-6 py-3 rounded-xl font-bold shadow-2xl animate-in slide-in-from-bottom-4 duration-300 flex items-center gap-2">
            <mat-icon>check_circle</mat-icon>
            Marketplace Added Successfully!
          </div>
        }

        <!-- Error Toast -->
        @if (adminError()) {
          <div class="fixed bottom-8 right-8 z-[200] bg-red-500 text-white px-6 py-4 rounded-2xl shadow-2xl flex items-center gap-4 animate-in slide-in-from-right-8">
            <mat-icon>error</mat-icon>
            <span class="font-medium">{{ adminError() }}</span>
            <button (click)="adminError.set(null)" class="ml-4 p-1 hover:bg-white/10 rounded-full">
              <mat-icon class="text-sm">close</mat-icon>
            </button>
          </div>
        }

        <!-- Confirmation Modal -->
        @if (confirmAction()) {
          <div class="fixed inset-0 z-[200] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
            <div class="bg-[#0B1120] border border-white/10 rounded-3xl p-8 max-w-sm w-full shadow-2xl animate-in zoom-in">
              <h3 class="text-xl font-bold text-white mb-4">Confirm Action</h3>
              <p class="text-gray-400 mb-8">{{ confirmAction()?.message }}</p>
              <div class="flex gap-4">
                <button (click)="confirmAction.set(null)" class="flex-1 py-3 bg-white/5 text-white rounded-xl font-bold hover:bg-white/10 transition-all">Cancel</button>
                <button (click)="confirmAction()?.action()" class="flex-1 py-3 bg-red-500 text-white rounded-xl font-bold hover:bg-red-600 transition-all">Confirm</button>
              </div>
            </div>
          </div>
        }
      </main>
    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar {
      width: 4px;
    }
    .custom-scrollbar::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.02);
    }
    .custom-scrollbar::-webkit-scrollbar-thumb {
      background: rgba(56, 189, 248, 0.2);
      border-radius: 10px;
    }
    .custom-scrollbar::-webkit-scrollbar-thumb:hover {
      background: rgba(56, 189, 248, 0.4);
    }
  `],
})
export class AdminComponent implements OnInit {
  private router = inject(Router);
  currentSection = signal<'users' | 'deposits' | 'orders' | 'tickets' | 'payment-methods' | 'site-settings' | 'marketplaces'>('users');
  
  users = signal<User[]>([]);
  deposits = signal<Deposit[]>([]);
  orders = signal<Order[]>([]);
  tickets = signal<Ticket[]>([]);
  paymentMethods = signal<PaymentMethod[]>([]);
  marketplaces = signal<Marketplace[]>([]);
  siteSettings = signal<SiteSettings>({ instagramUrl: '', showInstagramCard: true });
  
  isSavingSettings = signal(false);
  showSettingsToast = signal(false);
  adminError = signal<string | null>(null);
  confirmAction = signal<{ message: string, action: () => void } | null>(null);
  
  selectedUser = signal<User | null>(null);
  adminStats = computed(() => {
    const allUsers = this.users();
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    
    return {
      totalUsers: allUsers.length,
      activeToday: allUsers.filter(u => u.lastLogin && u.lastLogin.toMillis() >= today).length,
      newSignupsToday: allUsers.filter(u => u.createdAt && u.createdAt.toMillis() >= today).length
    };
  });

  userOrders = (uid: string) => this.orders().filter(o => o.userId === uid).slice(0, 5);

  isOnline(user: User): boolean {
    if (!user.lastActive) return false;
    const tenMinutesAgo = Date.now() - 10 * 60 * 1000;
    return user.lastActive.toMillis() > tenMinutesAgo;
  }

  viewUser(user: User) {
    this.selectedUser.set(user);
  }

  selectedTicket = signal<Ticket | null>(null);
  replyMessage = signal('');
  isReplying = signal(false);
  selectedFile = signal<File | null>(null);
  filePreview = signal<string | null>(null);
  selectedImage = signal<string | null>(null);

  // Marketplace Management
  isSavingMarketplace = signal(false);
  showMarketplaceToast = signal(false);
  editingMarketplace = signal<Marketplace | null>(null);
  logoFile = signal<File | null>(null);
  logoPreview = signal<string | null>(null);
  marketplaceForm = {
    name: '',
    redirectUrl: '',
    logoUrl: '',
    order: 0
  };

  newMethod = {
    name: '',
    address: '',
    instructions: ''
  };

  ngOnInit() {
    // Users
    getDocs(query(collection(db, 'users'), orderBy('createdAt', 'desc'))).then(snap => {
      this.users.set(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    });

    // Deposits
    getDocs(query(collection(db, 'deposits'), orderBy('createdAt', 'desc'))).then(snap => {
      this.deposits.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deposit)));
    });

    // Orders
    getDocs(query(collection(db, 'orders'), orderBy('createdAt', 'desc'))).then(snap => {
      this.orders.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    });

    // Tickets
    getDocs(query(collection(db, 'tickets'), orderBy('createdAt', 'desc'))).then(snap => {
      this.tickets.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket)));
    });

    // Payment Methods
    getDocs(query(collection(db, 'paymentMethods'), orderBy('createdAt', 'desc'))).then(snap => {
      this.paymentMethods.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
    });

    // Site Settings
    getDoc(doc(db, 'site_settings', 'main')).then(snap => {
      if (snap.exists()) {
        this.siteSettings.set(snap.data() as SiteSettings);
      }
    });

    // Marketplaces
    getDocs(query(collection(db, 'marketplaces'), orderBy('order', 'asc'))).then(snap => {
      this.marketplaces.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Marketplace)));
    });
  }

  onLogoSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        this.adminError.set('Logo file size limit: 2MB');
        return;
      }
      this.logoFile.set(file);
      const reader = new FileReader();
      reader.onload = () => this.logoPreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  async saveMarketplace() {
    if (!this.marketplaceForm.name) return;
    this.isSavingMarketplace.set(true);
    try {
      let logoUrl = this.marketplaceForm.logoUrl;
      if (this.logoFile()) {
        const storageRef = ref(storage, `marketplaces/${Date.now()}_${this.logoFile()!.name}`);
        const snapshot = await uploadBytes(storageRef, this.logoFile()!);
        logoUrl = await getDownloadURL(snapshot.ref);
      }

      if (!logoUrl) {
        this.adminError.set('Please upload a logo image.');
        return;
      }

      const editing = this.editingMarketplace();
      if (editing) {
        await updateDoc(doc(db, 'marketplaces', editing.id), {
          ...this.marketplaceForm,
          logoUrl
        });
      } else {
        const mpRef = doc(collection(db, 'marketplaces'));
        await runTransaction(db, async (transaction) => {
          transaction.set(mpRef, {
            id: mpRef.id,
            ...this.marketplaceForm,
            logoUrl,
            isActive: true,
            createdAt: serverTimestamp()
          });
        });
      }

      this.cancelEditMarketplace();
      this.showMarketplaceToast.set(true);
      setTimeout(() => this.showMarketplaceToast.set(false), 3000);
      
      // Refresh marketplaces
      const snap = await getDocs(query(collection(db, 'marketplaces'), orderBy('order', 'asc')));
      this.marketplaces.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Marketplace)));
    } catch (error) {
      console.error('Error saving marketplace:', error);
      this.adminError.set('Failed to save marketplace.');
    } finally {
      this.isSavingMarketplace.set(false);
    }
  }

  editMarketplace(mp: Marketplace) {
    this.editingMarketplace.set(mp);
    this.marketplaceForm = {
      name: mp.name,
      redirectUrl: mp.redirectUrl || '',
      logoUrl: mp.logoUrl,
      order: mp.order || 0
    };
    this.logoPreview.set(null);
    this.logoFile.set(null);
  }

  cancelEditMarketplace() {
    this.editingMarketplace.set(null);
    this.marketplaceForm = { name: '', redirectUrl: '', logoUrl: '', order: 0 };
    this.logoFile.set(null);
    this.logoPreview.set(null);
  }

  async toggleMarketplaceStatus(mp: Marketplace) {
    try {
      await updateDoc(doc(db, 'marketplaces', mp.id), {
        isActive: !mp.isActive
      });
    } catch (error) {
      console.error('Error toggling marketplace status:', error);
    }
  }

  deleteMarketplace(id: string) {
    this.confirmAction.set({
      message: 'Are you sure you want to delete this marketplace logo?',
      action: async () => {
        try {
          await runTransaction(db, async (transaction) => {
            transaction.delete(doc(db, 'marketplaces', id));
          });
          this.confirmAction.set(null);
        } catch (error) {
          console.error('Error deleting marketplace:', error);
          this.adminError.set('Failed to delete marketplace.');
        }
      }
    });
  }

  async addPaymentMethod() {
    if (!this.newMethod.name || !this.newMethod.address) return;
    try {
      const methodRef = doc(collection(db, 'paymentMethods'));
      await runTransaction(db, async (transaction) => {
        transaction.set(methodRef, {
          id: methodRef.id,
          ...this.newMethod,
          isActive: true,
          createdAt: serverTimestamp()
        });
      });
      this.newMethod = { name: '', address: '', instructions: '' };
    } catch (error) {
      console.error('Error adding payment method:', error);
    }
  }

  async toggleMethodStatus(method: PaymentMethod) {
    try {
      await updateDoc(doc(db, 'paymentMethods', method.id), {
        isActive: !method.isActive
      });
    } catch (error) {
      console.error('Error toggling status:', error);
    }
  }

  deletePaymentMethod(id: string) {
    this.confirmAction.set({
      message: 'Are you sure you want to delete this payment method?',
      action: async () => {
        try {
          await runTransaction(db, async (transaction) => {
            transaction.delete(doc(db, 'paymentMethods', id));
          });
          this.confirmAction.set(null);
        } catch (error) {
          console.error('Error deleting payment method:', error);
          this.adminError.set('Failed to delete payment method.');
        }
      }
    });
  }

  toggleInstagramCard() {
    this.siteSettings.update(s => ({ ...s, showInstagramCard: !s.showInstagramCard }));
  }

  async saveSiteSettings() {
    this.isSavingSettings.set(true);
    try {
      const { setDoc } = await import('firebase/firestore');
      await setDoc(doc(db, 'site_settings', 'main'), this.siteSettings(), { merge: true });
      this.showSettingsToast.set(true);
      setTimeout(() => this.showSettingsToast.set(false), 3000);
    } catch (error: unknown) {
      console.error('Error saving settings:', error);
    } finally {
      this.isSavingSettings.set(false);
    }
  }

  async handleDeposit(dep: Deposit, status: 'approved' | 'rejected') {
    if (dep.status !== 'pending') return;
    try {
      await runTransaction(db, async (transaction) => {
        const depRef = doc(db, 'deposits', dep.id);
        const userRef = doc(db, 'users', dep.userId);
        
        transaction.update(depRef, { status });
        
        if (status === 'approved') {
          transaction.update(userRef, {
            balance: increment(dep.amount),
            totalDeposit: increment(dep.amount)
          });
        }
      });
    } catch (error) {
      console.error('Error handling deposit:', error);
    }
  }

  async updateOrderStatus(orderId: string, status: string) {
    try {
      await runTransaction(db, async (transaction) => {
        const orderRef = doc(db, 'orders', orderId);
        const orderSnap = await transaction.get(orderRef);
        if (!orderSnap.exists()) return;
        
        const orderData = orderSnap.data();
        const oldStatus = orderData['status'];
        
        transaction.update(orderRef, { status });
        
        // If status is changed to refunded, return balance
        if (status === 'refunded' && oldStatus !== 'refunded') {
          const userRef = doc(db, 'users', orderData['userId']);
          transaction.update(userRef, {
            balance: increment(orderData['charge']),
            totalSpent: increment(-orderData['charge'])
          });
        }
      });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  }

  onFileSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    const file = target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        this.adminError.set('Maximum file size: 5MB');
        return;
      }
      this.selectedFile.set(file);
      const reader = new FileReader();
      reader.onload = () => this.filePreview.set(reader.result as string);
      reader.readAsDataURL(file);
    }
  }

  async uploadImage(file: File): Promise<string> {
    const storageRef = ref(storage, `tickets/${Date.now()}_${file.name}`);
    const snapshot = await uploadBytes(storageRef, file);
    return await getDownloadURL(snapshot.ref);
  }

  async replyToTicket(ticketId: string) {
    if (!this.replyMessage().trim()) return;

    this.isReplying.set(true);
    try {
      let imageUrl = '';
      if (this.selectedFile()) {
        imageUrl = await this.uploadImage(this.selectedFile()!);
      }

      const ticketRef = doc(db, 'tickets', ticketId);
      const reply = {
        sender: 'admin',
        message: this.replyMessage().trim(),
        imageUrl: imageUrl || null,
        timestamp: Timestamp.now()
      };

      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ticketRef);
        const replies = snap.data()?.['replies'] || [];
        transaction.update(ticketRef, {
          replies: [...replies, reply]
        });
      });

      this.replyMessage.set('');
      this.selectedFile.set(null);
      this.filePreview.set(null);
    } catch (error) {
      console.error('Reply error:', error);
    } finally {
      this.isReplying.set(false);
    }
  }

  async closeTicket(ticketId: string) {
    try {
      await updateDoc(doc(db, 'tickets', ticketId), { status: 'closed' });
    } catch (error) {
      console.error('Error closing ticket:', error);
    }
  }

  async logout() {
    try {
      await signOut(auth);
      this.router.navigate(['/login']);
    } catch (error) {
      console.error('Logout error:', error);
    }
  }
}
