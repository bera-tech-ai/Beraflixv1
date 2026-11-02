import ShelfScreen from '../../components/ShelfScreen';
import { getCatalog } from '../../lib/catalog';

export const metadata = { title: 'My Shelf' };
export const dynamic = 'force-dynamic';

export default async function ShelfPage() {
  try {
    const { items } = await getCatalog();
    const catalog = [...new Map(items.map((item) => [item.detailPath, item])).values()];
    return <ShelfScreen catalog={catalog} />;
  } catch (error) {
    console.error('Shelf catalog load failed:', error?.message || 'Unknown error');
    return <ShelfScreen catalog={[]} />;
  }
}
