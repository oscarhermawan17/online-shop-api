import {
  CustomerType,
  DiscountApplyMode,
  DiscountTriggerType,
  DiscountValueType,
} from '@prisma/client';

export interface VariantDiscountRuleLike {
  id: string;
  triggerType: DiscountTriggerType;
  minThreshold: number;
  maxThreshold: number | null;
  valueType: DiscountValueType;
  value: number;
  applyMode: DiscountApplyMode;
  customerType: CustomerType | null;
  isActive: boolean;
  priority: number;
}

export interface VariantDiscountContext {
  quantity: number;
  unitPrice: number;
  customerType: CustomerType;
}

export interface ResolvedVariantDiscount {
  rule: VariantDiscountRuleLike | null;
  lineSubtotal: number;
  lineDiscount: number;
  effectiveLineTotal: number;
  effectiveUnitPrice: number;
}

const clamp = (value: number, min: number, max: number): number => {
  if (value < min) return min;
  if (value > max) return max;
  return value;
};

const isRuleApplicable = (
  rule: VariantDiscountRuleLike,
  ctx: VariantDiscountContext,
): boolean => {
  if (!rule.isActive) {
    return false;
  }

  if (rule.customerType && rule.customerType !== ctx.customerType) {
    return false;
  }

  const lineSubtotal = ctx.unitPrice * ctx.quantity;
  const metric = rule.triggerType === 'quantity' ? ctx.quantity : lineSubtotal;

  if (metric < rule.minThreshold) {
    return false;
  }

  if (rule.maxThreshold !== null && metric > rule.maxThreshold) {
    return false;
  }

  return true;
};

const getRuleDiscountAmount = (
  rule: VariantDiscountRuleLike,
  ctx: VariantDiscountContext,
): number => {
  const lineSubtotal = ctx.unitPrice * ctx.quantity;

  let discount = 0;

  if (rule.valueType === 'percentage') {
    const baseAmount = rule.applyMode === 'per_item'
      ? ctx.unitPrice
      : lineSubtotal;

    const percentageDiscount = Math.round((baseAmount * rule.value) / 100);
    discount = rule.applyMode === 'per_item'
      ? percentageDiscount * ctx.quantity
      : percentageDiscount;
  } else {
    discount = rule.applyMode === 'per_item'
      ? rule.value * ctx.quantity
      : rule.value;
  }

  return clamp(discount, 0, lineSubtotal);
};

export const resolveVariantDiscount = (
  rules: VariantDiscountRuleLike[],
  ctx: VariantDiscountContext,
): ResolvedVariantDiscount => {
  const lineSubtotal = Math.max(0, ctx.unitPrice * ctx.quantity);

  if (ctx.quantity <= 0 || ctx.unitPrice < 0) {
    return {
      rule: null,
      lineSubtotal,
      lineDiscount: 0,
      effectiveLineTotal: lineSubtotal,
      effectiveUnitPrice: ctx.unitPrice,
    };
  }

  const applicableRules = rules
    .filter((rule) => isRuleApplicable(rule, ctx))
    .map((rule) => ({
      rule,
      discountAmount: getRuleDiscountAmount(rule, ctx),
    }))
    .sort((a, b) => {
      if (b.discountAmount !== a.discountAmount) {
        return b.discountAmount - a.discountAmount;
      }

      if (b.rule.priority !== a.rule.priority) {
        return b.rule.priority - a.rule.priority;
      }

      if (b.rule.minThreshold !== a.rule.minThreshold) {
        return b.rule.minThreshold - a.rule.minThreshold;
      }

      return a.rule.id.localeCompare(b.rule.id);
    });

  const selected = applicableRules[0];

  if (!selected) {
    return {
      rule: null,
      lineSubtotal,
      lineDiscount: 0,
      effectiveLineTotal: lineSubtotal,
      effectiveUnitPrice: ctx.unitPrice,
    };
  }

  const lineDiscount = clamp(selected.discountAmount, 0, lineSubtotal);
  const discountedLine = lineSubtotal - lineDiscount;

  // Keep integer unit price because order item snapshot stores unit price only.
  const effectiveUnitPrice = ctx.quantity > 0
    ? Math.max(0, Math.floor(discountedLine / ctx.quantity))
    : ctx.unitPrice;

  const effectiveLineTotal = effectiveUnitPrice * ctx.quantity;

  return {
    rule: selected.rule,
    lineSubtotal,
    lineDiscount: lineSubtotal - effectiveLineTotal,
    effectiveLineTotal,
    effectiveUnitPrice,
  };
};
