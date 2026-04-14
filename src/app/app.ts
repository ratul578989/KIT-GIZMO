import {ChangeDetectionStrategy, Component} from '@angular/core';
import { RouterModule } from '@angular/router';
import { db } from '../firebase';
import { doc, getDocFromServer } from 'firebase/firestore';

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  standalone: true,
  imports: [RouterModule],
  template: `<router-outlet></router-outlet>`,
})
export class App {
  private async testConnection() {
    try {
      // Test connection to Firestore
      await getDocFromServer(doc(db, '_connection_test_', 'ping'));
    } catch (error: unknown) {
      const err = error as { message?: string };
      if (err?.message?.includes('the client is offline')) {
        console.error("Firebase Configuration Error: The client is offline. Please check your Firebase configuration in firebase-applet-config.json.");
      }
      // Other errors are expected if the document doesn't exist, we just want to check connectivity
    }
  }
}
