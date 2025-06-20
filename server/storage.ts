import { 
  type Habit, 
  type InsertHabit,
  type HabitCompletion,
  type InsertHabitCompletion,
  type EmotionalCheckIn,
  type InsertEmotionalCheckIn,
  type JournalEntry,
  type InsertJournalEntry,
  type TradeReview,
  type InsertTradeReview,
  type GoalTracking,
  type InsertGoalTracking,
  type RiskMetrics,
  type InsertRiskMetrics,
  type HabitWithStats,
  habits,
  habitCompletions,
  emotionalCheckIns,
  journalEntries,
  tradeReviews,
  goalTracking,
  riskMetrics
} from "@shared/schema";
import { db } from "./db";
import { eq, and, gte, lte, count, sql, desc } from "drizzle-orm";

export interface IStorage {
  // Habits
  getHabits(): Promise<Habit[]>;
  getHabit(id: number): Promise<Habit | undefined>;
  createHabit(habit: InsertHabit): Promise<Habit>;
  updateHabit(id: number, habit: Partial<InsertHabit>): Promise<Habit | undefined>;
  deleteHabit(id: number): Promise<boolean>;
  
  // Habit Completions
  getHabitCompletions(habitId: number, startDate?: string, endDate?: string): Promise<HabitCompletion[]>;
  getHabitCompletion(habitId: number, date: string): Promise<HabitCompletion | undefined>;
  createOrUpdateHabitCompletion(completion: InsertHabitCompletion): Promise<HabitCompletion>;
  
  // Emotional Check-ins
  getEmotionalCheckIn(date: string): Promise<EmotionalCheckIn | undefined>;
  createOrUpdateEmotionalCheckIn(checkIn: InsertEmotionalCheckIn): Promise<EmotionalCheckIn>;
  
  // Journal Entries
  getJournalEntry(date: string): Promise<JournalEntry | undefined>;
  createOrUpdateJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry>;
  
  // Trade Reviews
  getTradeReviews(startDate?: string, endDate?: string): Promise<TradeReview[]>;
  getTradeReview(id: number): Promise<TradeReview | undefined>;
  createTradeReview(review: InsertTradeReview): Promise<TradeReview>;
  updateTradeReview(id: number, review: Partial<InsertTradeReview>): Promise<TradeReview | undefined>;
  deleteTradeReview(id: number): Promise<boolean>;

  // Goal Tracking
  getGoals(): Promise<GoalTracking[]>;
  getGoal(id: number): Promise<GoalTracking | undefined>;
  createGoal(goal: InsertGoalTracking): Promise<GoalTracking>;
  updateGoal(id: number, goal: Partial<InsertGoalTracking>): Promise<GoalTracking | undefined>;
  deleteGoal(id: number): Promise<boolean>;

  // Risk Metrics
  getRiskMetrics(date: string): Promise<RiskMetrics | undefined>;
  createOrUpdateRiskMetrics(metrics: InsertRiskMetrics): Promise<RiskMetrics>;

  // Analytics
  getHabitsWithStats(date: string): Promise<HabitWithStats[]>;
  getWeeklyProgress(startDate: string, endDate: string): Promise<{ date: string; completionRate: number }[]>;
  getMonthlyStats(year: number, month: number): Promise<{
    bestStreak: number;
    totalHabits: number;
    completionRate: number;
    perfectDays: number;
  }>;
  getTradingStats(startDate: string, endDate: string): Promise<{
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    emotionalStates: Record<string, number>;
  }>;
}

export class MemStorage implements IStorage {
  private habits: Map<number, Habit>;
  private habitCompletions: Map<string, HabitCompletion>;
  private emotionalCheckIns: Map<string, EmotionalCheckIn>;
  private journalEntries: Map<string, JournalEntry>;
  private tradeReviews: Map<number, TradeReview>;
  private goals: Map<number, GoalTracking>;
  private riskMetrics: Map<string, RiskMetrics>;
  private currentHabitId: number;
  private currentCompletionId: number;
  private currentCheckInId: number;
  private currentJournalId: number;
  private currentTradeId: number;
  private currentGoalId: number;
  private currentRiskId: number;

  constructor() {
    this.habits = new Map();
    this.habitCompletions = new Map();
    this.emotionalCheckIns = new Map();
    this.journalEntries = new Map();
    this.tradeReviews = new Map();
    this.goals = new Map();
    this.riskMetrics = new Map();
    this.currentHabitId = 1;
    this.currentCompletionId = 1;
    this.currentCheckInId = 1;
    this.currentJournalId = 1;
    this.currentTradeId = 1;
    this.currentGoalId = 1;
    this.currentRiskId = 1;

    // Initialize with default data
    this.initializeDefaultHabits();
    this.initializeDefaultGoals();
  }

  private initializeDefaultHabits() {
    const defaultHabits: InsertHabit[] = [
      {
        name: "Avoid Overtrading",
        description: "Maximum 3 trades per day, focus on quality over quantity",
        category: "Risk Management"
      },
      {
        name: "Honor Stop Losses",
        description: "Exit positions when stop loss is hit, no exceptions",
        category: "Risk Management"
      },
      {
        name: "Wait for Setup",
        description: "Only trade when all criteria are met, be patient",
        category: "Emotional Control"
      },
      {
        name: "Review Trades Daily",
        description: "Spend 10 minutes analyzing today's trades",
        category: "Analysis & Research"
      }
    ];

    defaultHabits.forEach(habit => this.createHabit(habit));
  }

  private initializeDefaultGoals() {
    const defaultGoals: InsertGoalTracking[] = [
      {
        title: "Monthly Profit Target",
        description: "Achieve consistent monthly profits",
        targetValue: "5000",
        currentValue: "0",
        unit: "USD",
        deadline: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        category: "profit"
      },
      {
        title: "Maximum Daily Loss Limit",
        description: "Never lose more than 2% of account in a single day",
        targetValue: "2",
        currentValue: "0",
        unit: "percent",
        deadline: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        category: "risk"
      },
      {
        title: "Trading Journal Consistency",
        description: "Log every trade with detailed analysis",
        targetValue: "100",
        currentValue: "0",
        unit: "percent",
        deadline: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        category: "discipline"
      }
    ];

    for (const goal of defaultGoals) {
      const goalTracking: GoalTracking = {
        ...goal,
        description: goal.description || null,
        currentValue: goal.currentValue || "0",
        deadline: goal.deadline || null,
        id: this.currentGoalId++,
        isActive: true
      };
      this.goals.set(goalTracking.id, goalTracking);
    }
  }

  // Habits
  async getHabits(): Promise<Habit[]> {
    return Array.from(this.habits.values()).filter(h => h.isActive);
  }

  async getHabit(id: number): Promise<Habit | undefined> {
    return this.habits.get(id);
  }

  async createHabit(insertHabit: InsertHabit): Promise<Habit> {
    const habit: Habit = {
      ...insertHabit,
      description: insertHabit.description || null,
      category: insertHabit.category || "custom",
      id: this.currentHabitId++,
      isActive: true
    };
    this.habits.set(habit.id, habit);
    return habit;
  }

  async updateHabit(id: number, updates: Partial<InsertHabit>): Promise<Habit | undefined> {
    const habit = this.habits.get(id);
    if (!habit) return undefined;
    
    const updatedHabit = { ...habit, ...updates };
    this.habits.set(id, updatedHabit);
    return updatedHabit;
  }

  async deleteHabit(id: number): Promise<boolean> {
    const habit = this.habits.get(id);
    if (!habit) return false;
    
    const updatedHabit = { ...habit, isActive: false };
    this.habits.set(id, updatedHabit);
    return true;
  }

  // Habit Completions
  async getHabitCompletions(habitId: number, startDate?: string, endDate?: string): Promise<HabitCompletion[]> {
    return Array.from(this.habitCompletions.values()).filter(completion => {
      if (completion.habitId !== habitId) return false;
      if (startDate && completion.date < startDate) return false;
      if (endDate && completion.date > endDate) return false;
      return true;
    });
  }

  async getHabitCompletion(habitId: number, date: string): Promise<HabitCompletion | undefined> {
    const key = `${habitId}-${date}`;
    return this.habitCompletions.get(key);
  }

  async createOrUpdateHabitCompletion(completion: InsertHabitCompletion): Promise<HabitCompletion> {
    const key = `${completion.habitId}-${completion.date}`;
    const existing = this.habitCompletions.get(key);
    
    if (existing) {
      const updated = { ...existing, completed: completion.completed ?? false };
      this.habitCompletions.set(key, updated);
      return updated;
    } else {
      const newCompletion: HabitCompletion = {
        ...completion,
        completed: completion.completed ?? false,
        id: this.currentCompletionId++
      };
      this.habitCompletions.set(key, newCompletion);
      return newCompletion;
    }
  }

  // Emotional Check-ins
  async getEmotionalCheckIn(date: string): Promise<EmotionalCheckIn | undefined> {
    return this.emotionalCheckIns.get(date);
  }

  async createOrUpdateEmotionalCheckIn(checkIn: InsertEmotionalCheckIn): Promise<EmotionalCheckIn> {
    const existing = this.emotionalCheckIns.get(checkIn.date);
    
    if (existing) {
      const updated = { ...existing, mood: checkIn.mood };
      this.emotionalCheckIns.set(checkIn.date, updated);
      return updated;
    } else {
      const newCheckIn: EmotionalCheckIn = {
        ...checkIn,
        id: this.currentCheckInId++
      };
      this.emotionalCheckIns.set(checkIn.date, newCheckIn);
      return newCheckIn;
    }
  }

  // Journal Entries
  async getJournalEntry(date: string): Promise<JournalEntry | undefined> {
    return this.journalEntries.get(date);
  }

  async createOrUpdateJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const existing = this.journalEntries.get(entry.date);
    
    if (existing) {
      const updated = { ...existing, content: entry.content };
      this.journalEntries.set(entry.date, updated);
      return updated;
    } else {
      const newEntry: JournalEntry = {
        ...entry,
        id: this.currentJournalId++
      };
      this.journalEntries.set(entry.date, newEntry);
      return newEntry;
    }
  }

  // Analytics
  async getHabitsWithStats(date: string): Promise<HabitWithStats[]> {
    const habits = await this.getHabits();
    const today = new Date(date);
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    
    return Promise.all(habits.map(async (habit) => {
      const completions = await this.getHabitCompletions(habit.id);
      const monthlyCompletions = completions.filter(c => 
        c.date >= startOfMonth.toISOString().split('T')[0] && 
        c.date <= endOfMonth.toISOString().split('T')[0] &&
        c.completed
      );
      
      const completedToday = completions.some(c => c.date === date && c.completed);
      
      // Calculate streak
      let currentStreak = 0;
      const sortedCompletions = completions.sort((a, b) => b.date.localeCompare(a.date));
      const checkDate = new Date(date);
      
      for (let i = 0; i < 365; i++) {
        const dateStr = checkDate.toISOString().split('T')[0];
        const completion = sortedCompletions.find(c => c.date === dateStr);
        
        if (completion && completion.completed) {
          currentStreak++;
        } else {
          break;
        }
        
        checkDate.setDate(checkDate.getDate() - 1);
      }
      
      const totalDaysThisMonth = endOfMonth.getDate();
      const completionRate = totalDaysThisMonth > 0 ? (monthlyCompletions.length / totalDaysThisMonth) * 100 : 0;
      
      return {
        ...habit,
        currentStreak,
        completionRate: Math.round(completionRate),
        completedToday,
        monthlyCompletions: monthlyCompletions.length,
        totalDaysThisMonth
      };
    }));
  }

  async getWeeklyProgress(startDate: string, endDate: string): Promise<{ date: string; completionRate: number }[]> {
    const habits = await this.getHabits();
    const result: { date: string; completionRate: number }[] = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      let totalHabits = habits.length;
      let completedHabits = 0;
      
      for (const habit of habits) {
        const completion = await this.getHabitCompletion(habit.id, dateStr);
        if (completion && completion.completed) {
          completedHabits++;
        }
      }
      
      const completionRate = totalHabits > 0 ? (completedHabits / totalHabits) * 100 : 0;
      result.push({ date: dateStr, completionRate: Math.round(completionRate) });
    }
    
    return result;
  }

  async getMonthlyStats(year: number, month: number): Promise<{
    bestStreak: number;
    totalHabits: number;
    completionRate: number;
    perfectDays: number;
  }> {
    const habits = await this.getHabits();
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0);
    
    let bestStreak = 0;
    let totalCompletions = 0;
    let totalPossible = 0;
    let perfectDays = 0;
    
    // Calculate per day
    for (let d = new Date(startOfMonth); d <= endOfMonth; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      let dayCompletions = 0;
      
      for (const habit of habits) {
        const completion = await this.getHabitCompletion(habit.id, dateStr);
        if (completion && completion.completed) {
          dayCompletions++;
          totalCompletions++;
        }
        totalPossible++;
      }
      
      if (dayCompletions === habits.length && habits.length > 0) {
        perfectDays++;
      }
    }
    
    // Calculate best streak (simplified)
    const weeklyProgress = await this.getWeeklyProgress(
      startOfMonth.toISOString().split('T')[0],
      endOfMonth.toISOString().split('T')[0]
    );
    
    let currentStreak = 0;
    for (const day of weeklyProgress) {
      if (day.completionRate === 100) {
        currentStreak++;
        bestStreak = Math.max(bestStreak, currentStreak);
      } else {
        currentStreak = 0;
      }
    }
    
    const completionRate = totalPossible > 0 ? (totalCompletions / totalPossible) * 100 : 0;
    
    return {
      bestStreak,
      totalHabits: habits.length,
      completionRate: Math.round(completionRate),
      perfectDays
    };
  }

  // Trade Reviews
  async getTradeReviews(startDate?: string, endDate?: string): Promise<TradeReview[]> {
    return Array.from(this.tradeReviews.values()).filter(trade => {
      if (startDate && trade.date < startDate) return false;
      if (endDate && trade.date > endDate) return false;
      return true;
    });
  }

  async getTradeReview(id: number): Promise<TradeReview | undefined> {
    return this.tradeReviews.get(id);
  }

  async createTradeReview(review: InsertTradeReview): Promise<TradeReview> {
    const tradeReview: TradeReview = {
      ...review,
      exitPrice: review.exitPrice || null,
      pnl: review.pnl || null,
      tags: review.tags || null,
      emotionalState: review.emotionalState || null,
      setup: review.setup || null,
      mistakes: review.mistakes || null,
      lessons: review.lessons || null,
      rating: review.rating || null,
      id: this.currentTradeId++
    };
    this.tradeReviews.set(tradeReview.id, tradeReview);
    return tradeReview;
  }

  async updateTradeReview(id: number, review: Partial<InsertTradeReview>): Promise<TradeReview | undefined> {
    const existing = this.tradeReviews.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...review };
    this.tradeReviews.set(id, updated);
    return updated;
  }

  async deleteTradeReview(id: number): Promise<boolean> {
    return this.tradeReviews.delete(id);
  }

  // Goal Tracking
  async getGoals(): Promise<GoalTracking[]> {
    return Array.from(this.goals.values()).filter(g => g.isActive);
  }

  async getGoal(id: number): Promise<GoalTracking | undefined> {
    return this.goals.get(id);
  }

  async createGoal(goal: InsertGoalTracking): Promise<GoalTracking> {
    const goalTracking: GoalTracking = {
      ...goal,
      description: goal.description || null,
      currentValue: goal.currentValue || "0",
      deadline: goal.deadline || null,
      id: this.currentGoalId++,
      isActive: true
    };
    this.goals.set(goalTracking.id, goalTracking);
    return goalTracking;
  }

  async updateGoal(id: number, goal: Partial<InsertGoalTracking>): Promise<GoalTracking | undefined> {
    const existing = this.goals.get(id);
    if (!existing) return undefined;
    
    const updated = { ...existing, ...goal };
    this.goals.set(id, updated);
    return updated;
  }

  async deleteGoal(id: number): Promise<boolean> {
    const goal = this.goals.get(id);
    if (!goal) return false;
    
    const updated = { ...goal, isActive: false };
    this.goals.set(id, updated);
    return true;
  }

  // Risk Metrics
  async getRiskMetrics(date: string): Promise<RiskMetrics | undefined> {
    return this.riskMetrics.get(date);
  }

  async createOrUpdateRiskMetrics(metrics: InsertRiskMetrics): Promise<RiskMetrics> {
    const existing = this.riskMetrics.get(metrics.date);
    
    if (existing) {
      const updated = { ...existing, ...metrics };
      this.riskMetrics.set(metrics.date, updated);
      return updated;
    } else {
      const newMetrics: RiskMetrics = {
        date: metrics.date,
        accountBalance: metrics.accountBalance || null,
        maxDrawdown: metrics.maxDrawdown || null,
        dailyRisk: metrics.dailyRisk || null,
        positionSize: metrics.positionSize || null,
        riskRewardRatio: metrics.riskRewardRatio || null,
        id: this.currentRiskId++
      };
      this.riskMetrics.set(metrics.date, newMetrics);
      return newMetrics;
    }
  }

  async getTradingStats(startDate: string, endDate: string): Promise<{
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    emotionalStates: Record<string, number>;
  }> {
    const trades = await this.getTradeReviews(startDate, endDate);
    
    const totalTrades = trades.length;
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        emotionalStates: {}
      };
    }

    const tradesWithPnL = trades.filter(t => t.pnl && !isNaN(parseFloat(t.pnl)));
    const winningTrades = tradesWithPnL.filter(t => parseFloat(t.pnl!) > 0);
    const losingTrades = tradesWithPnL.filter(t => parseFloat(t.pnl!) < 0);
    
    const totalPnL = tradesWithPnL.reduce((sum, t) => sum + parseFloat(t.pnl!), 0);
    const winRate = tradesWithPnL.length > 0 ? (winningTrades.length / tradesWithPnL.length) * 100 : 0;
    
    const totalWins = winningTrades.reduce((sum, t) => sum + parseFloat(t.pnl!), 0);
    const totalLosses = Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.pnl!), 0));
    
    const avgWin = winningTrades.length > 0 ? totalWins / winningTrades.length : 0;
    const avgLoss = losingTrades.length > 0 ? totalLosses / losingTrades.length : 0;
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : totalWins > 0 ? 999 : 0;

    const emotionalStates: Record<string, number> = {};
    trades.forEach(trade => {
      if (trade.emotionalState) {
        emotionalStates[trade.emotionalState] = (emotionalStates[trade.emotionalState] || 0) + 1;
      }
    });

    return {
      totalTrades,
      winRate: Math.round(winRate),
      totalPnL: Math.round(totalPnL * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      emotionalStates
    };
  }
}

export class DatabaseStorage implements IStorage {
  async getHabits(): Promise<Habit[]> {
    return await db.select().from(habits).where(eq(habits.isActive, true)).orderBy(habits.name);
  }

  async getHabit(id: number): Promise<Habit | undefined> {
    const [habit] = await db.select().from(habits).where(eq(habits.id, id));
    return habit || undefined;
  }

  async createHabit(insertHabit: InsertHabit): Promise<Habit> {
    const [habit] = await db.insert(habits).values(insertHabit).returning();
    return habit;
  }

  async updateHabit(id: number, updates: Partial<InsertHabit>): Promise<Habit | undefined> {
    const [habit] = await db.update(habits).set(updates).where(eq(habits.id, id)).returning();
    return habit || undefined;
  }

  async deleteHabit(id: number): Promise<boolean> {
    const result = await db.update(habits).set({ isActive: false }).where(eq(habits.id, id));
    return result.rowCount > 0;
  }

  async getHabitCompletions(habitId: number, startDate?: string, endDate?: string): Promise<HabitCompletion[]> {
    let query = db.select().from(habitCompletions).where(eq(habitCompletions.habitId, habitId));
    
    if (startDate && endDate) {
      query = query.where(and(
        eq(habitCompletions.habitId, habitId),
        gte(habitCompletions.date, startDate),
        lte(habitCompletions.date, endDate)
      ));
    }
    
    return await query.orderBy(habitCompletions.date);
  }

  async getHabitCompletion(habitId: number, date: string): Promise<HabitCompletion | undefined> {
    const [completion] = await db.select().from(habitCompletions)
      .where(and(eq(habitCompletions.habitId, habitId), eq(habitCompletions.date, date)));
    return completion || undefined;
  }

  async createOrUpdateHabitCompletion(completion: InsertHabitCompletion): Promise<HabitCompletion> {
    const existing = await this.getHabitCompletion(completion.habitId, completion.date);
    
    if (existing) {
      const [updated] = await db.update(habitCompletions)
        .set({ completed: completion.completed })
        .where(and(eq(habitCompletions.habitId, completion.habitId), eq(habitCompletions.date, completion.date)))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(habitCompletions).values(completion).returning();
      return created;
    }
  }

  async getEmotionalCheckIn(date: string): Promise<EmotionalCheckIn | undefined> {
    const [checkIn] = await db.select().from(emotionalCheckIns).where(eq(emotionalCheckIns.date, date));
    return checkIn || undefined;
  }

  async createOrUpdateEmotionalCheckIn(checkIn: InsertEmotionalCheckIn): Promise<EmotionalCheckIn> {
    const existing = await this.getEmotionalCheckIn(checkIn.date);
    
    if (existing) {
      const [updated] = await db.update(emotionalCheckIns)
        .set({ mood: checkIn.mood })
        .where(eq(emotionalCheckIns.date, checkIn.date))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(emotionalCheckIns).values(checkIn).returning();
      return created;
    }
  }

  async getJournalEntry(date: string): Promise<JournalEntry | undefined> {
    const [entry] = await db.select().from(journalEntries).where(eq(journalEntries.date, date));
    return entry || undefined;
  }

  async createOrUpdateJournalEntry(entry: InsertJournalEntry): Promise<JournalEntry> {
    const existing = await this.getJournalEntry(entry.date);
    
    if (existing) {
      const [updated] = await db.update(journalEntries)
        .set({ content: entry.content })
        .where(eq(journalEntries.date, entry.date))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(journalEntries).values(entry).returning();
      return created;
    }
  }

  async getTradeReviews(startDate?: string, endDate?: string): Promise<TradeReview[]> {
    let query = db.select().from(tradeReviews);
    
    if (startDate && endDate) {
      query = query.where(and(
        gte(tradeReviews.date, startDate),
        lte(tradeReviews.date, endDate)
      ));
    }
    
    return await query.orderBy(desc(tradeReviews.date));
  }

  async getTradeReview(id: number): Promise<TradeReview | undefined> {
    const [review] = await db.select().from(tradeReviews).where(eq(tradeReviews.id, id));
    return review || undefined;
  }

  async createTradeReview(review: InsertTradeReview): Promise<TradeReview> {
    const [created] = await db.insert(tradeReviews).values(review).returning();
    return created;
  }

  async updateTradeReview(id: number, review: Partial<InsertTradeReview>): Promise<TradeReview | undefined> {
    const [updated] = await db.update(tradeReviews).set(review).where(eq(tradeReviews.id, id)).returning();
    return updated || undefined;
  }

  async deleteTradeReview(id: number): Promise<boolean> {
    const result = await db.delete(tradeReviews).where(eq(tradeReviews.id, id));
    return result.rowCount > 0;
  }

  async getGoals(): Promise<GoalTracking[]> {
    return await db.select().from(goalTracking).where(eq(goalTracking.isActive, true)).orderBy(goalTracking.title);
  }

  async getGoal(id: number): Promise<GoalTracking | undefined> {
    const [goal] = await db.select().from(goalTracking).where(eq(goalTracking.id, id));
    return goal || undefined;
  }

  async createGoal(goal: InsertGoalTracking): Promise<GoalTracking> {
    const [created] = await db.insert(goalTracking).values(goal).returning();
    return created;
  }

  async updateGoal(id: number, goal: Partial<InsertGoalTracking>): Promise<GoalTracking | undefined> {
    const [updated] = await db.update(goalTracking).set(goal).where(eq(goalTracking.id, id)).returning();
    return updated || undefined;
  }

  async deleteGoal(id: number): Promise<boolean> {
    const result = await db.update(goalTracking).set({ isActive: false }).where(eq(goalTracking.id, id));
    return result.rowCount > 0;
  }

  async getRiskMetrics(date: string): Promise<RiskMetrics | undefined> {
    const [metrics] = await db.select().from(riskMetrics).where(eq(riskMetrics.date, date));
    return metrics || undefined;
  }

  async createOrUpdateRiskMetrics(metrics: InsertRiskMetrics): Promise<RiskMetrics> {
    const existing = await this.getRiskMetrics(metrics.date);
    
    if (existing) {
      const [updated] = await db.update(riskMetrics)
        .set(metrics)
        .where(eq(riskMetrics.date, metrics.date))
        .returning();
      return updated;
    } else {
      const [created] = await db.insert(riskMetrics).values(metrics).returning();
      return created;
    }
  }

  async getHabitsWithStats(date: string): Promise<HabitWithStats[]> {
    const allHabits = await this.getHabits();
    const habitsWithStats: HabitWithStats[] = [];

    for (const habit of allHabits) {
      const today = new Date(date);
      const currentMonth = today.getMonth();
      const currentYear = today.getFullYear();
      const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      
      // Get completion for today
      const todayCompletion = await this.getHabitCompletion(habit.id, date);
      const completedToday = todayCompletion?.completed || false;

      // Get completions for current month
      const monthStart = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
      const monthEnd = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
      const monthlyCompletions = await this.getHabitCompletions(habit.id, monthStart, monthEnd);
      const completedDays = monthlyCompletions.filter(c => c.completed).length;
      
      // Calculate completion rate
      const completionRate = daysInMonth > 0 ? Math.round((completedDays / daysInMonth) * 100) : 0;

      // Calculate current streak
      let currentStreak = 0;
      const completionsMap = new Map(monthlyCompletions.map(c => [c.date, c.completed]));
      const checkDate = new Date(today);
      
      while (checkDate >= new Date(monthStart)) {
        const dateStr = checkDate.toISOString().split('T')[0];
        if (completionsMap.get(dateStr)) {
          currentStreak++;
        } else {
          break;
        }
        checkDate.setDate(checkDate.getDate() - 1);
      }

      habitsWithStats.push({
        ...habit,
        currentStreak,
        completionRate,
        completedToday,
        monthlyCompletions: completedDays,
        totalDaysThisMonth: daysInMonth
      });
    }

    return habitsWithStats;
  }

  async getWeeklyProgress(startDate: string, endDate: string): Promise<{ date: string; completionRate: number }[]> {
    const allHabits = await this.getHabits();
    const progress: { date: string; completionRate: number }[] = [];
    
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = d.toISOString().split('T')[0];
      let totalCompletions = 0;
      
      for (const habit of allHabits) {
        const completion = await this.getHabitCompletion(habit.id, dateStr);
        if (completion?.completed) {
          totalCompletions++;
        }
      }
      
      const completionRate = allHabits.length > 0 ? Math.round((totalCompletions / allHabits.length) * 100) : 0;
      progress.push({ date: dateStr, completionRate });
    }
    
    return progress;
  }

  async getMonthlyStats(year: number, month: number): Promise<{
    bestStreak: number;
    totalHabits: number;
    completionRate: number;
    perfectDays: number;
  }> {
    const allHabits = await this.getHabits();
    const daysInMonth = new Date(year, month, 0).getDate();
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;
    
    let totalCompletions = 0;
    let perfectDays = 0;
    let bestStreak = 0;
    
    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      let dayCompletions = 0;
      
      for (const habit of allHabits) {
        const completion = await this.getHabitCompletion(habit.id, dateStr);
        if (completion?.completed) {
          dayCompletions++;
          totalCompletions++;
        }
      }
      
      if (dayCompletions === allHabits.length && allHabits.length > 0) {
        perfectDays++;
      }
    }
    
    const totalPossible = allHabits.length * daysInMonth;
    const completionRate = totalPossible > 0 ? Math.round((totalCompletions / totalPossible) * 100) : 0;
    
    return {
      bestStreak,
      totalHabits: allHabits.length,
      completionRate,
      perfectDays
    };
  }

  async getTradingStats(startDate: string, endDate: string): Promise<{
    totalTrades: number;
    winRate: number;
    totalPnL: number;
    avgWin: number;
    avgLoss: number;
    profitFactor: number;
    emotionalStates: Record<string, number>;
  }> {
    const trades = await this.getTradeReviews(startDate, endDate);
    
    const totalTrades = trades.length;
    const emotionalStates: Record<string, number> = {};
    
    if (totalTrades === 0) {
      return {
        totalTrades: 0,
        winRate: 0,
        totalPnL: 0,
        avgWin: 0,
        avgLoss: 0,
        profitFactor: 0,
        emotionalStates: {}
      };
    }
    
    let wins = 0;
    let totalPnL = 0;
    let totalWins = 0;
    let totalLosses = 0;
    let winCount = 0;
    let lossCount = 0;
    
    trades.forEach(trade => {
      if (trade.pnl) {
        const pnl = parseFloat(trade.pnl);
        totalPnL += pnl;
        
        if (pnl > 0) {
          wins++;
          totalWins += pnl;
          winCount++;
        } else if (pnl < 0) {
          totalLosses += Math.abs(pnl);
          lossCount++;
        }
      }
      
      if (trade.emotionalState) {
        emotionalStates[trade.emotionalState] = (emotionalStates[trade.emotionalState] || 0) + 1;
      }
    });
    
    const winRate = (wins / totalTrades) * 100;
    const avgWin = winCount > 0 ? totalWins / winCount : 0;
    const avgLoss = lossCount > 0 ? totalLosses / lossCount : 0;
    const profitFactor = avgLoss > 0 ? avgWin / avgLoss : 0;
    
    return {
      totalTrades,
      winRate: Math.round(winRate),
      totalPnL: Math.round(totalPnL * 100) / 100,
      avgWin: Math.round(avgWin * 100) / 100,
      avgLoss: Math.round(avgLoss * 100) / 100,
      profitFactor: Math.round(profitFactor * 100) / 100,
      emotionalStates
    };
  }
}

export const storage = new DatabaseStorage();
