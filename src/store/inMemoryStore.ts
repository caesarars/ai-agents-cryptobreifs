import { newId } from '../utils/ids.js';
import type { AlertEvent, AlertRule, NotificationLog, User } from '../types/domain.js';

export class InMemoryStore {
  private users = new Map<string, User>();
  private rules = new Map<string, AlertRule>();
  private alerts: AlertEvent[] = [];
  private notifications: NotificationLog[] = [];
  private ruleCooldowns = new Map<string, number>();

  createUser(payload: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): User {
    const now = new Date();
    const user: User = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      ...payload
    };
    this.users.set(user.id, user);
    return user;
  }

  listUsers(): User[] {
    return [...this.users.values()];
  }

  getUser(id: string): User | undefined {
    return this.users.get(id);
  }

  createRule(payload: Omit<AlertRule, 'id' | 'createdAt' | 'updatedAt'>): AlertRule {
    const now = new Date();
    const rule: AlertRule = {
      id: newId(),
      createdAt: now,
      updatedAt: now,
      ...payload
    };
    this.rules.set(rule.id, rule);
    return rule;
  }

  listRules(): AlertRule[] {
    return [...this.rules.values()];
  }

  getRule(id: string): AlertRule | undefined {
    return this.rules.get(id);
  }

  updateRule(id: string, updates: Partial<AlertRule>): AlertRule | undefined {
    const rule = this.rules.get(id);
    if (!rule) return undefined;
    const updated: AlertRule = {
      ...rule,
      ...updates,
      updatedAt: new Date()
    };
    this.rules.set(id, updated);
    return updated;
  }

  deleteRule(id: string): boolean {
    return this.rules.delete(id);
  }

  listAlerts(): AlertEvent[] {
    return [...this.alerts];
  }

  addAlert(event: AlertEvent): void {
    this.alerts.push(event);
  }

  listNotifications(): NotificationLog[] {
    return [...this.notifications];
  }

  addNotification(notification: NotificationLog): void {
    this.notifications.push(notification);
  }

  getCooldown(ruleId: string): number | undefined {
    return this.ruleCooldowns.get(ruleId);
  }

  setCooldown(ruleId: string, timestamp: number): void {
    this.ruleCooldowns.set(ruleId, timestamp);
  }
}
