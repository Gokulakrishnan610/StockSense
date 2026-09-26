import { forwardRef } from 'react';
import type { LucideIcon, LucideProps } from 'lucide-react';
import {
  AlertCircle as AlertCircleGlyph,
  AlertTriangle as AlertTriangleGlyph,
  ArrowDownLeft as ArrowDownLeftGlyph,
  ArrowDownToLine as ArrowDownToLineGlyph,
  ArrowLeft as ArrowLeftGlyph,
  ArrowLeftRight as ArrowLeftRightGlyph,
  ArrowRight as ArrowRightGlyph,
  ArrowUpFromLine as ArrowUpFromLineGlyph,
  ArrowUpRight as ArrowUpRightGlyph,
  Boxes as BoxesGlyph,
  Check as CheckGlyph,
  CheckCircle2 as CheckCircle2Glyph,
  ChevronDown as ChevronDownGlyph,
  ChevronLeft as ChevronLeftGlyph,
  ChevronRight as ChevronRightGlyph,
  Clock as ClockGlyph,
  Copy as CopyGlyph,
  Edit3 as Edit3Glyph,
  ExternalLink as ExternalLinkGlyph,
  Eye as EyeGlyph,
  EyeOff as EyeOffGlyph,
  FolderTree as FolderTreeGlyph,
  History as HistoryGlyph,
  House as HouseGlyph,
  Info as InfoGlyph,
  Key as KeyGlyph,
  KeyRound as KeyRoundGlyph,
  Layers as LayersGlyph,
  LayoutDashboard as LayoutDashboardGlyph,
  Loader2 as Loader2Glyph,
  Lock as LockGlyph,
  LogIn as LogInGlyph,
  LogOut as LogOutGlyph,
  Mail as MailGlyph,
  MapPin as MapPinGlyph,
  Menu as MenuGlyph,
  Package as PackageGlyph,
  PackageOpen as PackageOpenGlyph,
  PanelLeftClose as PanelLeftCloseGlyph,
  PanelLeftOpen as PanelLeftOpenGlyph,
  Plus as PlusGlyph,
  Printer as PrinterGlyph,
  RefreshCw as RefreshCwGlyph,
  RotateCcw as RotateCcwGlyph,
  Search as SearchGlyph,
  Shield as ShieldGlyph,
  ShieldCheck as ShieldCheckGlyph,
  Sliders as SlidersGlyph,
  SlidersHorizontal as SlidersHorizontalGlyph,
  Trash2 as Trash2Glyph,
  User as UserGlyph,
  UserPlus as UserPlusGlyph,
  Warehouse as WarehouseGlyph,
  X as XGlyph,
  XCircle as XCircleGlyph,
} from 'lucide-react';

type IconProps = Omit<LucideProps, 'size' | 'strokeWidth' | 'color'> & { size?: 12 | 14 | 16 | 20 | 24 };

function withIconStyle(Glyph: LucideIcon) {
  return forwardRef<SVGSVGElement, IconProps>(function AppIcon({ size = 16, style, ...props }, ref) {
    return <Glyph {...props} ref={ref} size={size} strokeWidth={1.5} color="currentColor"
      style={{ ...style, color: 'inherit', flexShrink: 0 }} />;
  });
}

export const AlertCircle = withIconStyle(AlertCircleGlyph);
export const AlertTriangle = withIconStyle(AlertTriangleGlyph);
export const ArrowDownLeft = withIconStyle(ArrowDownLeftGlyph);
export const ArrowDownToLine = withIconStyle(ArrowDownToLineGlyph);
export const ArrowLeft = withIconStyle(ArrowLeftGlyph);
export const ArrowLeftRight = withIconStyle(ArrowLeftRightGlyph);
export const ArrowRight = withIconStyle(ArrowRightGlyph);
export const ArrowUpFromLine = withIconStyle(ArrowUpFromLineGlyph);
export const ArrowUpRight = withIconStyle(ArrowUpRightGlyph);
export const Boxes = withIconStyle(BoxesGlyph);
export const Check = withIconStyle(CheckGlyph);
export const CheckCircle2 = withIconStyle(CheckCircle2Glyph);
export const ChevronDown = withIconStyle(ChevronDownGlyph);
export const ChevronLeft = withIconStyle(ChevronLeftGlyph);
export const ChevronRight = withIconStyle(ChevronRightGlyph);
export const Clock = withIconStyle(ClockGlyph);
export const Copy = withIconStyle(CopyGlyph);
export const Edit3 = withIconStyle(Edit3Glyph);
export const ExternalLink = withIconStyle(ExternalLinkGlyph);
export const Eye = withIconStyle(EyeGlyph);
export const EyeOff = withIconStyle(EyeOffGlyph);
export const FolderTree = withIconStyle(FolderTreeGlyph);
export const History = withIconStyle(HistoryGlyph);
export const House = withIconStyle(HouseGlyph);
export const Info = withIconStyle(InfoGlyph);
export const Key = withIconStyle(KeyGlyph);
export const KeyRound = withIconStyle(KeyRoundGlyph);
export const Layers = withIconStyle(LayersGlyph);
export const LayoutDashboard = withIconStyle(LayoutDashboardGlyph);
export const Loader2 = withIconStyle(Loader2Glyph);
export const Lock = withIconStyle(LockGlyph);
export const LogIn = withIconStyle(LogInGlyph);
export const LogOut = withIconStyle(LogOutGlyph);
export const Mail = withIconStyle(MailGlyph);
export const MapPin = withIconStyle(MapPinGlyph);
export const Menu = withIconStyle(MenuGlyph);
export const Package = withIconStyle(PackageGlyph);
export const PackageOpen = withIconStyle(PackageOpenGlyph);
export const PanelLeftClose = withIconStyle(PanelLeftCloseGlyph);
export const PanelLeftOpen = withIconStyle(PanelLeftOpenGlyph);
export const Plus = withIconStyle(PlusGlyph);
export const Printer = withIconStyle(PrinterGlyph);
export const RefreshCw = withIconStyle(RefreshCwGlyph);
export const RotateCcw = withIconStyle(RotateCcwGlyph);
export const Search = withIconStyle(SearchGlyph);
export const Shield = withIconStyle(ShieldGlyph);
export const ShieldCheck = withIconStyle(ShieldCheckGlyph);
export const Sliders = withIconStyle(SlidersGlyph);
export const SlidersHorizontal = withIconStyle(SlidersHorizontalGlyph);
export const Trash2 = withIconStyle(Trash2Glyph);
export const User = withIconStyle(UserGlyph);
export const UserPlus = withIconStyle(UserPlusGlyph);
export const Warehouse = withIconStyle(WarehouseGlyph);
export const X = withIconStyle(XGlyph);
export const XCircle = withIconStyle(XCircleGlyph);
