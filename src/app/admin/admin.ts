import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { auth, db } from '../../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, runTransaction, Timestamp } from 'firebase/firestore';

interface User {
  uid: string;
  fullName: string;
  email: string;
  role: string;
  balance: number;
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
  status: string;
  replies: { sender: string, message: string, timestamp: Timestamp }[];
  createdAt: Timestamp;
}

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, RouterModule, MatIconModule, FormsModule],
  template: `
    <div class="min-h-screen bg-[#020617] text-white font-sans flex flex-col md:flex-row">
      <!-- Sidebar -->
      <aside class="w-full md:w-72 border-r border-white/10 flex flex-col bg-[#020617]">
        <div class="p-6 text-2xl font-bold tracking-tighter border-b border-white/10 text-[#38BDF8]">ADMIN PANEL</div>
        
        <nav class="flex-1 p-4 space-y-2">
          <button 
            (click)="currentSection.set('users')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'users' ? 'bg-[#38BDF8] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>people</mat-icon>
            User Management
          </button>
          <button 
            (click)="currentSection.set('deposits')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'deposits' ? 'bg-[#38BDF8] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>account_balance_wallet</mat-icon>
            Manage Deposits
          </button>
          <button 
            (click)="currentSection.set('orders')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'orders' ? 'bg-[#38BDF8] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>shopping_cart</mat-icon>
            Manage Orders
          </button>
          <button 
            (click)="currentSection.set('tickets')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'tickets' ? 'bg-[#38BDF8] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>confirmation_number</mat-icon>
            Admin Tickets
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
        <header class="mb-8">
          <h1 class="text-2xl font-bold capitalize">{{ currentSection().replace('-', ' ') }}</h1>
        </header>

        <!-- Users Section -->
        @if (currentSection() === 'users') {
          <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="text-gray-500 text-xs font-bold uppercase tracking-widest border-b border-white/5">
                    <th class="p-6">User</th>
                    <th class="p-6">Role</th>
                    <th class="p-6">Balance</th>
                    <th class="p-6">Joined</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  @for (user of users(); track user.uid) {
                    <tr class="hover:bg-white/5 transition-colors">
                      <td class="p-6">
                        <div class="font-medium">{{ user.fullName }}</div>
                        <div class="text-xs text-gray-500">{{ user.email }}</div>
                      </td>
                      <td class="p-6">
                        <span [class]="user.role === 'admin' ? 'text-emerald-400' : 'text-[#38BDF8]'">
                          {{ user.role }}
                        </span>
                      </td>
                      <td class="p-6 font-bold text-[#38BDF8]">{{ user.balance | number:'1.2-2' }}</td>
                      <td class="p-6 text-gray-500 text-sm">
                        {{ user.createdAt?.toDate() | date:'mediumDate' }}
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            </div>
          </div>
        }

        <!-- Deposits Section -->
        @if (currentSection() === 'deposits') {
          <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="text-gray-500 text-xs font-bold uppercase tracking-widest border-b border-white/5">
                    <th class="p-6">User</th>
                    <th class="p-6">Amount</th>
                    <th class="p-6">Transaction ID</th>
                    <th class="p-6">Status</th>
                    <th class="p-6">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  @for (dep of deposits(); track dep.id) {
                    <tr class="hover:bg-white/5 transition-colors">
                      <td class="p-6">
                        <div class="text-sm">{{ dep.userEmail }}</div>
                        <div class="text-[10px] text-gray-500">{{ dep.createdAt?.toDate() | date:'short' }}</div>
                      </td>
                      <td class="p-6 font-bold text-[#38BDF8]">{{ dep.amount | number:'1.2-2' }}</td>
                      <td class="p-6 text-xs font-mono text-gray-400">{{ dep.transactionId }}</td>
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
          <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div class="overflow-x-auto">
              <table class="w-full text-left">
                <thead>
                  <tr class="text-gray-500 text-xs font-bold uppercase tracking-widest border-b border-white/5">
                    <th class="p-6">Order</th>
                    <th class="p-6">User</th>
                    <th class="p-6">Status</th>
                    <th class="p-6">Actions</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-white/5">
                  @for (order of orders(); track order.id) {
                    <tr class="hover:bg-white/5 transition-colors">
                      <td class="p-6">
                        <div class="font-medium">{{ order.service }}</div>
                        <div class="text-xs text-gray-500">{{ order.quantity | number }} units - {{ order.charge | number:'1.2-2' }}</div>
                      </td>
                      <td class="p-6 text-sm text-gray-400">{{ order.userEmail }}</td>
                      <td class="p-6">
                        <span [class]="'px-2 py-1 rounded text-[10px] font-bold uppercase ' + 
                          (order.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400' : 
                           order.status === 'cancelled' ? 'bg-red-500/10 text-red-400' : 
                           'bg-blue-500/10 text-blue-400')">
                          {{ order.status }}
                        </span>
                      </td>
                      <td class="p-6">
                        <select 
                          (change)="updateOrderStatus(order.id, $any($event.target).value)"
                          class="bg-white/5 border border-white/10 rounded p-2 text-xs outline-none focus:border-[#38BDF8]"
                        >
                          <option value="" disabled selected>Update Status</option>
                          <option value="processing">Processing</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
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
              <div class="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-4">
                <div class="flex justify-between items-start">
                  <div>
                    <h3 class="text-lg font-bold">{{ ticket.subject }}</h3>
                    <p class="text-sm text-gray-400">From: {{ ticket.userEmail }}</p>
                  </div>
                  <span [class]="'px-2 py-1 rounded text-[10px] font-bold uppercase ' + (ticket.status === 'open' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-gray-500/10 text-gray-400')">
                    {{ ticket.status }}
                  </span>
                </div>
                
                <div class="bg-white/5 p-4 rounded-xl text-sm italic text-gray-300 border-l-2 border-[#38BDF8]">
                  "{{ ticket.message }}"
                </div>

                <div class="space-y-2">
                  @for (reply of ticket.replies; track reply.timestamp) {
                    <div [class]="'p-3 rounded-xl text-xs ' + (reply.sender === 'admin' ? 'bg-[#38BDF8]/10 ml-8 text-right' : 'bg-white/5 mr-8')">
                      <div class="font-bold mb-1">{{ reply.sender === 'admin' ? 'You' : 'User' }}</div>
                      <div>{{ reply.message }}</div>
                    </div>
                  }
                </div>

                @if (ticket.status === 'open') {
                  <div class="flex gap-2">
                    <input 
                      #replyInput
                      type="text" 
                      placeholder="Type your reply..."
                      class="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm outline-none focus:border-[#38BDF8]"
                    >
                    <button 
                      (click)="replyToTicket(ticket.id, replyInput.value); replyInput.value = ''"
                      class="px-4 py-2 bg-[#38BDF8] text-[#020617] rounded-xl font-bold text-sm"
                    >
                      Reply
                    </button>
                    <button 
                      (click)="closeTicket(ticket.id)"
                      class="px-4 py-2 bg-white/5 border border-white/10 rounded-xl font-bold text-sm hover:bg-white/10"
                    >
                      Close
                    </button>
                  </div>
                }
              </div>
            } @empty {
              <div class="p-12 text-center text-gray-500 bg-white/5 border border-white/10 rounded-2xl">
                No support tickets found.
              </div>
            }
          </div>
        }
      </main>
    </div>
  `,
  styles: ``,
})
export class AdminComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  currentSection = signal<'users' | 'deposits' | 'orders' | 'tickets'>('users');
  
  users = signal<User[]>([]);
  deposits = signal<Deposit[]>([]);
  orders = signal<Order[]>([]);
  tickets = signal<Ticket[]>([]);

  private unsubscribers: (() => void)[] = [];

  ngOnInit() {
    // Real-time Users
    const usersQ = query(collection(db, 'users'), orderBy('createdAt', 'desc'));
    this.unsubscribers.push(onSnapshot(usersQ, (snap) => {
      this.users.set(snap.docs.map(doc => ({ uid: doc.id, ...doc.data() } as User)));
    }));

    // Real-time Deposits
    const depositsQ = query(collection(db, 'deposits'), orderBy('createdAt', 'desc'));
    this.unsubscribers.push(onSnapshot(depositsQ, (snap) => {
      this.deposits.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Deposit)));
    }));

    // Real-time Orders
    const ordersQ = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    this.unsubscribers.push(onSnapshot(ordersQ, (snap) => {
      this.orders.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order)));
    }));

    // Real-time Tickets
    const ticketsQ = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
    this.unsubscribers.push(onSnapshot(ticketsQ, (snap) => {
      this.tickets.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ticket)));
    }));
  }

  ngOnDestroy() {
    this.unsubscribers.forEach(unsub => unsub());
  }

  async handleDeposit(dep: Deposit, status: 'approved' | 'rejected') {
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
      await updateDoc(doc(db, 'orders', orderId), { status });
    } catch (error) {
      console.error('Error updating order status:', error);
    }
  }

  async replyToTicket(ticketId: string, message: string) {
    if (!message.trim()) return;
    try {
      const ticketRef = doc(db, 'tickets', ticketId);
      const reply = {
        sender: 'admin',
        message: message.trim(),
        timestamp: Timestamp.now()
      };
      await runTransaction(db, async (transaction) => {
        const snap = await transaction.get(ticketRef);
        const replies = snap.data()?.['replies'] || [];
        transaction.update(ticketRef, {
          replies: [...replies, reply]
        });
      });
    } catch (error) {
      console.error('Error replying to ticket:', error);
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
