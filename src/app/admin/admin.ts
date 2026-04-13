import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { FormsModule } from '@angular/forms';
import { auth, db } from '../../firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, increment, runTransaction, Timestamp, serverTimestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../../firebase';

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
          <button 
            (click)="currentSection.set('payment-methods')"
            [class]="'w-full flex items-center gap-3 p-3 rounded-xl font-medium transition-all ' + (currentSection() === 'payment-methods' ? 'bg-[#38BDF8] text-[#020617]' : 'text-gray-400 hover:bg-white/5 hover:text-white')"
          >
            <mat-icon>payments</mat-icon>
            Payment Methods
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
                    <th class="p-6">Method</th>
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
                      <td class="p-6 text-xs text-gray-400">{{ dep.methodName || 'USDT TRC20' }}</td>
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
                          class="bg-white/5 border border-white/10 rounded-xl p-2 text-xs outline-none focus:border-[#38BDF8] cursor-pointer"
                        >
                          <option value="" disabled selected>Update Status</option>
                          <option value="pending">Pending</option>
                          <option value="processing">Processing</option>
                          <option value="completed">Completed</option>
                          <option value="cancelled">Cancelled</option>
                          <option value="refunded">Refunded</option>
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
              <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
                <div class="p-6 border-b border-white/5 flex justify-between items-center bg-white/[0.02]">
                  <div>
                    <h3 class="text-lg font-bold text-[#38BDF8]">{{ ticket.subject }}</h3>
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
                      <mat-icon class="text-gray-400">person</mat-icon>
                    </div>
                    <div class="space-y-2 flex-1">
                      <div class="bg-white/5 p-4 rounded-2xl rounded-tl-none border border-white/5 text-sm leading-relaxed">
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
                      <div [class]="'w-10 h-10 rounded-full flex items-center justify-center shrink-0 border ' + (reply.sender === 'admin' ? 'bg-[#38BDF8] text-[#020617] border-[#38BDF8]' : 'bg-white/5 text-gray-400 border-white/10')">
                        <mat-icon>{{ reply.sender === 'admin' ? 'support_agent' : 'person' }}</mat-icon>
                      </div>
                      <div [class]="'space-y-2 flex-1 ' + (reply.sender === 'admin' ? 'text-right' : '')">
                        <div [class]="'inline-block p-4 rounded-2xl border text-sm leading-relaxed ' + 
                          (reply.sender === 'admin' ? 'bg-[#38BDF8]/10 border-[#38BDF8]/20 rounded-tr-none text-left' : 'bg-white/5 border-white/5 rounded-tl-none')">
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
                    <div class="pt-6 border-t border-white/5 space-y-4">
                      <div class="flex gap-4 items-end">
                        <div class="flex-1 space-y-2">
                          <textarea 
                            #replyMsg
                            (input)="replyMessage.set(replyMsg.value)"
                            [value]="replyMessage()"
                            rows="2"
                            placeholder="Type your response..."
                            class="w-full bg-white/5 border border-white/10 rounded-xl py-3 px-4 focus:border-[#38BDF8] outline-none transition-all resize-none text-sm"
                          ></textarea>
                        </div>
                        
                        <div class="flex gap-2">
                          <label class="cursor-pointer">
                            <input type="file" class="hidden" (change)="onFileSelected($event)" accept="image/*">
                            <div class="p-3 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all group">
                              <mat-icon class="text-gray-400 group-hover:text-[#38BDF8]">add_a_photo</mat-icon>
                            </div>
                          </label>
                          <button 
                            (click)="replyToTicket(ticket.id)"
                            [disabled]="isReplying() || !replyMessage().trim()"
                            class="px-6 py-3 bg-[#38BDF8] text-[#020617] rounded-xl hover:bg-[#38BDF8]/90 transition-all disabled:opacity-50 font-bold flex items-center gap-2"
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
                        <div class="relative w-20 h-20 rounded-xl overflow-hidden border border-[#38BDF8]/30 group">
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
          <button (click)="selectedImage.set(null)" class="absolute top-8 right-8 text-white hover:text-[#38BDF8] transition-colors">
            <mat-icon class="text-4xl">close</mat-icon>
          </button>
          <img [src]="selectedImage()" alt="Enlarged attachment" class="max-w-full max-h-full object-contain rounded-xl shadow-2xl animate-in zoom-in duration-300" (click)="$event.stopPropagation()" (keydown.enter)="$event.stopPropagation()" tabindex="0" referrerpolicy="no-referrer">
        </div>
      }

        <!-- Payment Methods Section -->
        @if (currentSection() === 'payment-methods') {
          <div class="space-y-8">
            <!-- Add New Method Form -->
            <div class="bg-white/5 border border-white/10 rounded-2xl p-8 space-y-6">
              <h2 class="text-xl font-bold">Add New Payment Method</h2>
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="space-y-2">
                  <label for="method-name" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Method Name</label>
                  <input id="method-name" [(ngModel)]="newMethod.name" type="text" placeholder="e.g. USDT TRC20" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#38BDF8]">
                </div>
                <div class="space-y-2">
                  <label for="wallet-address" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Wallet Address</label>
                  <input id="wallet-address" [(ngModel)]="newMethod.address" type="text" placeholder="Enter wallet address" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#38BDF8]">
                </div>
                <div class="space-y-2 md:col-span-2">
                  <label for="method-instr" class="text-xs font-bold text-gray-500 uppercase tracking-widest">Instructions</label>
                  <input id="method-instr" [(ngModel)]="newMethod.instructions" type="text" placeholder="Specific instructions for user" class="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-[#38BDF8]">
                </div>
              </div>
              <button (click)="addPaymentMethod()" class="px-8 py-3 bg-[#38BDF8] text-[#020617] font-bold rounded-xl hover:bg-[#38BDF8]/90 transition-all">
                Add Payment Method
              </button>
            </div>

            <!-- List of Methods -->
            <div class="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
              <div class="overflow-x-auto">
                <table class="w-full text-left">
                  <thead>
                    <tr class="text-gray-500 text-xs font-bold uppercase tracking-widest border-b border-white/5">
                      <th class="p-6">Method</th>
                      <th class="p-6">Address</th>
                      <th class="p-6">Status</th>
                      <th class="p-6">Actions</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-white/5">
                    @for (method of paymentMethods(); track method.id) {
                      <tr class="hover:bg-white/5 transition-colors">
                        <td class="p-6 font-medium">{{ method.name }}</td>
                        <td class="p-6 text-xs font-mono text-gray-400">{{ method.address }}</td>
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
      </main>
    </div>
  `,
  styles: ``,
})
export class AdminComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  currentSection = signal<'users' | 'deposits' | 'orders' | 'tickets' | 'payment-methods'>('users');
  
  users = signal<User[]>([]);
  deposits = signal<Deposit[]>([]);
  orders = signal<Order[]>([]);
  tickets = signal<Ticket[]>([]);
  paymentMethods = signal<PaymentMethod[]>([]);
  
  selectedTicket = signal<Ticket | null>(null);
  replyMessage = signal('');
  isReplying = signal(false);
  selectedFile = signal<File | null>(null);
  filePreview = signal<string | null>(null);
  selectedImage = signal<string | null>(null);

  newMethod = {
    name: '',
    address: '',
    instructions: ''
  };

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

    // Real-time Payment Methods
    const methodsQ = query(collection(db, 'paymentMethods'), orderBy('createdAt', 'desc'));
    this.unsubscribers.push(onSnapshot(methodsQ, (snap) => {
      this.paymentMethods.set(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as PaymentMethod)));
    }));
  }

  ngOnDestroy() {
    this.unsubscribers.forEach(unsub => unsub());
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

  async deletePaymentMethod(id: string) {
    if (!confirm('Are you sure you want to delete this payment method?')) return;
    try {
      await runTransaction(db, async (transaction) => {
        transaction.delete(doc(db, 'paymentMethods', id));
      });
    } catch (error) {
      console.error('Error deleting payment method:', error);
    }
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
        alert('Maximum file size: 5MB');
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
