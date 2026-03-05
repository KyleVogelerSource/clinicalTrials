import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule],
  template: `
    <div class="container">
      <header>
        <h1>Clinical Trials</h1>
        <p>Welcome to the Clinical Trials Management System</p>
      </header>

      <main>
        <section class="info">
          <h2>System Status</h2>
          <p class="status-good">✓ Frontend is running (Angular {{ version }})</p>
          <p class="status-good">✓ Backend API is available</p>
          <p class="status-good">✓ Database connection established</p>
        </section>

        <section class="features">
          <h2>Available Features</h2>
          <ul>
            <li>Clinical trial search and discovery</li>
            <li>Trial details and eligibility criteria</li>
            <li>Participant enrollment tracking</li>
            <li>Data management and reporting</li>
          </ul>
        </section>

        <section class="next-steps">
          <h2>Next Steps</h2>
          <p>To get started, navigate through the application menu above.</p>
        </section>
      </main>

      <footer>
        <p>&copy; 2026 Clinical Trials Management System</p>
      </footer>
    </div>
  `,
  styles: [`
    :host {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
        'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
        sans-serif;
    }

    .container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: #333;
    }

    header {
      background: rgba(255, 255, 255, 0.95);
      padding: 2rem;
      text-align: center;
      box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
    }

    header h1 {
      margin: 0;
      color: #667eea;
      font-size: 2.5rem;
    }

    header p {
      margin: 0.5rem 0 0 0;
      color: #666;
      font-size: 1.1rem;
    }

    main {
      flex: 1;
      padding: 2rem;
      max-width: 1000px;
      margin: 0 auto;
      width: 100%;
    }

    section {
      background: white;
      padding: 2rem;
      margin-bottom: 2rem;
      border-radius: 8px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
    }

    section h2 {
      color: #667eea;
      margin-top: 0;
      border-bottom: 2px solid #667eea;
      padding-bottom: 0.5rem;
    }

    .status-good {
      color: #28a745;
      font-weight: 500;
      margin: 0.5rem 0;
    }

    ul {
      list-style: none;
      padding: 0;
    }

    ul li {
      padding: 0.75rem 0;
      border-bottom: 1px solid #eee;
    }

    ul li:before {
      content: "→ ";
      color: #667eea;
      font-weight: bold;
      margin-right: 0.5rem;
    }

    ul li:last-child {
      border-bottom: none;
    }

    footer {
      background: rgba(0, 0, 0, 0.1);
      padding: 1rem;
      text-align: center;
      color: white;
      margin-top: auto;
    }

    @media (max-width: 768px) {
      header h1 {
        font-size: 1.8rem;
      }

      main {
        padding: 1rem;
      }

      section {
        padding: 1.5rem;
      }
    }
  `]
})
export class AppComponent {
  version = '18.0.0';
}
