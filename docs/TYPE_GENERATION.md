# Type Generation Guide

## Generate Types from Supabase

After setting up your schema, generate TypeScript types from your Supabase project:

### 1. Install Supabase CLI
```bash
npm install supabase --save-dev
```

### 2. Login to Supabase
```bash
npx supabase login
```

### 3. Generate Types
```bash
npx supabase gen types typescript --project-id YOUR_PROJECT_ID > src/types/database.types.ts
```

Or link to your project first:
```bash
npx supabase link --project-ref YOUR_PROJECT_ID
npx supabase gen types typescript --linked > src/types/database.types.ts
```

## Usage Examples

### Using `Row<'items'>` in a Component

```tsx
import { Row } from '@/types/database.types'

// The Row generic gives you the full row type
type ItemRow = Row<'items'>

interface ItemCardProps {
  item: Row<'items'>
}

export function ItemCard({ item }: ItemCardProps) {
  return (
    <div>
      <h3>{item.name}</h3>
      <p>SKU: {item.sku}</p>
      <p>Price: ${item.rental_price}/day</p>
    </div>
  )
}
```

### Using with Server Components

```tsx
// app/admin/items/page.tsx
import { createClient } from '@/lib/supabase/server'
import { Row } from '@/types/database.types'

export default async function ItemsPage() {
  const supabase = await createClient()
  
  const { data: items } = await supabase
    .from('items')
    .select('*')
    .returns<Row<'items'>[]>()
  
  return (
    <ul>
      {items?.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  )
}
```

### Calling Database Functions

```tsx
import { createClient } from '@/lib/supabase/server'

// Check availability before creating reservation
async function checkAvailability(itemId: string, startAt: Date, endAt: Date) {
  const supabase = await createClient()
  
  const { data, error } = await supabase
    .rpc('is_item_available', {
      p_item_id: itemId,
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
    })
  
  return data === true
}

// Get all available items for a date range
async function getAvailableItems(startAt: Date, endAt: Date) {
  const supabase = await createClient()
  
  const { data } = await supabase
    .rpc('get_available_items', {
      p_start_at: startAt.toISOString(),
      p_end_at: endAt.toISOString(),
    })
  
  return data
}
```
