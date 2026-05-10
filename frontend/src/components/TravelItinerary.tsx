import { useState } from "react";
import { Calendar, Clock, Trash2, Plus, Edit2, Check, MapPin, GripVertical } from "lucide-react";
import { getPlaceImage } from "@/utils/getPlaceImage";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { useDroppable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";

export interface Activity {
  id: string;
  time: string;
  title: string;
  description: string;
  type: "attraction" | "food" | "transport" | "rest";
  image?: string;
  image_url?: string | null;
  photo_url?: string | null;
  lat?: number;
  lng?: number;
}

export interface DayPlan {
  day: number;
  date: string;
  activities: Activity[];
}

interface TravelItineraryProps {
  itinerary: DayPlan[];
  onUpdate: (itinerary: DayPlan[]) => void;
  onSelectActivity?: (activity: Activity) => void;
  onHoverActivity?: (id: string | null) => void;
  activeDragId?: string | null;
}

export const typeConfig: Record<string, { label: string; color: string }> = {
  attraction: { label: "Attraction", color: "bg-primary/15 text-primary border-primary/20" },
  food: { label: "Food & Drink", color: "bg-travel-sunset/20 text-travel-sunset border-travel-sunset/20" },
  transport: { label: "Transport", color: "bg-travel-forest/15 text-travel-forest border-travel-forest/20" },
  rest: { label: "Wellness", color: "bg-travel-sand text-foreground border-travel-sand" },
};

export const DAY_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f43f5e'];

export const PLACEHOLDER_IMAGES: Record<string, string> = {
  "Arrive at Ngurah Rai Airport": "https://images.unsplash.com/photo-1583417319070-4a69db38a482?w=600&h=400&fit=crop",
  "Seminyak Beach": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=600&h=400&fit=crop",
  "Lunch at Coral Kitchen": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?w=600&h=400&fit=crop",
  "Tanah Lot Temple Sunset": "https://images.unsplash.com/photo-1577717903315-1691ae25ab3f?w=600&h=400&fit=crop",
  "Mount Batur Sunrise Trek": "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=600&h=400&fit=crop",
  "Tegallalang Rice Terrace": "https://images.unsplash.com/photo-1558005137-d9619a5c539f?w=600&h=400&fit=crop",
  "Lunch in Ubud": "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=600&h=400&fit=crop",
  "Ubud Monkey Forest": "https://images.unsplash.com/photo-1540202404-a2f29016b523?w=600&h=400&fit=crop",
  "Spa & Relaxation": "https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=600&h=400&fit=crop",
  "Uluwatu Temple": "https://images.unsplash.com/photo-1555400038-63f5ba517a47?w=600&h=400&fit=crop",
  "Local Art Market": "https://images.unsplash.com/photo-1555529771-835f59fc5efe?w=600&h=400&fit=crop",
  "Farewell Lunch": "https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=600&h=400&fit=crop",
  "Departure": "https://images.unsplash.com/photo-1436491865332-7a61a109db56?w=600&h=400&fit=crop",
  "Tanah Lot Temple": "https://images.unsplash.com/photo-1577717903315-1691ae25ab3f?w=600&h=400&fit=crop",
  "Mount Batur": "https://images.unsplash.com/photo-1518548419970-58e3b4079ab2?w=600&h=400&fit=crop",
};

export const DEFAULT_IMAGE = "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=600&h=400&fit=crop";

export function getActivityImage(activity: Activity): string {
  return activity.image_url || activity.image || PLACEHOLDER_IMAGES[activity.title] || DEFAULT_IMAGE;
}

interface SortableCardProps {
  activity: Activity;
  dayIndex: number;
  isSelected: boolean;
  editingId: string | null;
  editValue: string;
  onCardClick: (activity: Activity) => void;
  onStartEdit: (id: string, title: string) => void;
  onSaveEdit: (dayIndex: number, activityId: string) => void;
  onRemove: (dayIndex: number, activityId: string) => void;
  onEditValueChange: (value: string) => void;
  onHover: (id: string | null) => void;
  dayColor: string;
  index: number;
  isDragOverlay?: boolean;
}

const SortableCard = ({
  activity,
  dayIndex,
  isSelected,
  editingId,
  editValue,
  onCardClick,
  onStartEdit,
  onSaveEdit,
  onRemove,
  onEditValueChange,
  onHover,
  dayColor,
  index,
  isDragOverlay,
}: SortableCardProps) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: activity.id, data: { type: "itinerary-card", dayIndex } });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const config = typeConfig[activity.type as keyof typeof typeConfig] ?? typeConfig.attraction;

  return (
    <div
      ref={setNodeRef}
      style={{ 
        ...style, 
        borderColor: isSelected ? dayColor : undefined,
        boxShadow: isSelected ? `0 0 0 2px ${dayColor}` : undefined
      }}
      onClick={() => onCardClick(activity)}
      onMouseEnter={() => onHover(activity.id)}
      onMouseLeave={() => onHover(null)}
      className={`group relative w-full rounded-2xl overflow-hidden bg-card border shadow-sm hover:shadow-lg transition-all duration-300 cursor-pointer ${isDragging ? "opacity-30" : ""
        } ${isDragOverlay ? "shadow-2xl scale-[1.01] rotate-0.5" : ""} ${isSelected ? "shadow-lg scale-[1.01]" : "border-border hover:border-primary/30"
        }`}
    >
      <div className="relative h-40 overflow-hidden">
        <img
          src={activity.image_url || `https://source.unsplash.com/800x600/?${encodeURIComponent(activity.title)}`}
          alt={activity.title}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
          loading="lazy"
          onError={(e) => {
            e.currentTarget.src = "https://source.unsplash.com/800x600/?travel,landmark";
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-foreground/40 to-transparent" />

        <div
          {...attributes}
          {...listeners}
          onClick={(e) => e.stopPropagation()}
          className="absolute top-3 right-12 flex items-center gap-1 bg-card/90 backdrop-blur-sm rounded-full px-2 py-1 text-xs font-medium text-foreground shadow-sm cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="w-3 h-3 text-muted-foreground" />
          <Clock className="w-3 h-3" />
          {activity.time}
        </div>

        <div className="absolute top-3 right-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={(e) => { e.stopPropagation(); onStartEdit(activity.id, activity.title); }}
            className="p-1.5 rounded-full bg-card/90 backdrop-blur-sm hover:bg-card shadow-sm"
          >
            <Edit2 className="w-3 h-3 text-muted-foreground" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(dayIndex, activity.id); }}
            className="p-1.5 rounded-full bg-card/90 backdrop-blur-sm hover:bg-destructive/10 shadow-sm"
          >
            <Trash2 className="w-3 h-3 text-destructive" />
          </button>
        </div>

        {isSelected && (
          <div 
            className="absolute bottom-3 right-3 w-8 h-8 rounded-full flex items-center justify-center shadow-md animate-pulse-soft"
            style={{ backgroundColor: dayColor }}
          >
            <MapPin className="w-4 h-4 text-primary-foreground" />
          </div>
        )}

        {/* Activity Order Number */}
        <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-md shadow-lg w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-primary border border-primary/20 z-10">
          {index + 1}
        </div>
      </div>

      <div className="p-4">
        <Badge variant="outline" className={`text-[10px] mb-2 ${config.color}`}>
          {config.label}
        </Badge>

        {editingId === activity.id ? (
          <div className="flex items-center gap-2">
            <Input
              value={editValue}
              onChange={(e) => onEditValueChange(e.target.value)}
              className="h-7 text-sm"
              onKeyDown={(e) => e.key === "Enter" && onSaveEdit(dayIndex, activity.id)}
              onClick={(e) => e.stopPropagation()}
              autoFocus
            />
            <button onClick={(e) => { e.stopPropagation(); onSaveEdit(dayIndex, activity.id); }} className="text-primary shrink-0">
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <h4 className="font-semibold text-foreground text-sm leading-snug line-clamp-2">{activity.title}</h4>
        )}

        <p className="text-xs text-muted-foreground mt-1.5 line-clamp-2">{activity.description}</p>
      </div>
    </div>
  );
};

interface DroppableDayProps {
  dayIndex: number;
  isOver: boolean;
  children: React.ReactNode;
}

const DroppableDay = ({ dayIndex, isOver, children }: DroppableDayProps) => {
  const { setNodeRef } = useDroppable({
    id: `day-${dayIndex}`,
    data: { type: "day", dayIndex },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-4 pb-4 rounded-2xl transition-all duration-200 ${isOver ? "ring-2 ring-primary/50 ring-dashed bg-primary/5 p-2 -m-2" : ""
        }`}
    >
      {children}
    </div>
  );
};

const TravelItinerary = ({ itinerary, onUpdate, onSelectActivity, onHoverActivity, activeDragId }: TravelItineraryProps) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const removeActivity = (dayIndex: number, activityId: string) => {
    const updated = itinerary.map((day, i) =>
      i === dayIndex ? { ...day, activities: day.activities.filter((a) => a.id !== activityId) } : day
    );
    onUpdate(updated);
  };

  const addActivity = (dayIndex: number) => {
    const newActivity: Activity = {
      id: `act-${Date.now()}`,
      time: "12:00",
      title: "New Activity",
      description: "Add details here",
      type: "attraction",
    };
    const updated = itinerary.map((day, i) =>
      i === dayIndex ? { ...day, activities: [...day.activities, newActivity] } : day
    );
    onUpdate(updated);
  };

  const startEdit = (id: string, title: string) => {
    setEditingId(id);
    setEditValue(title);
  };

  const saveEdit = (dayIndex: number, activityId: string) => {
    const updated = itinerary.map((day, i) =>
      i === dayIndex
        ? { ...day, activities: day.activities.map((a) => (a.id === activityId ? { ...a, title: editValue } : a)) }
        : day
    );
    onUpdate(updated);
    setEditingId(null);
  };

  const handleCardClick = (activity: Activity) => {
    setSelectedId(activity.id === selectedId ? null : activity.id);
    onSelectActivity?.(activity);
  };

  // Check if an attraction is being dragged (for highlighting drop zones)
  const isDraggingAttraction = activeDragId?.startsWith("attraction-") ?? false;

  return (
    <div className="animate-slide-up w-full max-w-7xl mx-auto px-4">
      <div className="flex items-center justify-between mb-8">
        <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Calendar className="w-6 h-6 text-primary" />
          Your Travel Itinerary
        </h2>
        <span className="text-sm text-muted-foreground">{itinerary.length} days</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 items-start">
        {itinerary.map((day, dayIndex) => (
          <div key={day.day} className="bg-slate-50/50 dark:bg-slate-900/20 rounded-3xl p-6 border border-border/50 h-full flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div 
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-primary-foreground font-bold text-base shadow-lg transition-transform"
                style={{ backgroundColor: DAY_COLORS[dayIndex % DAY_COLORS.length] }}
              >
                {day.day}
              </div>
              <div>
                <h3 className="font-semibold text-foreground text-lg">Day {day.day}</h3>
                <p className="text-sm text-muted-foreground">{day.date}</p>
                {isDraggingAttraction && (
                  <p className="text-xs text-primary font-medium mt-0.5 animate-pulse">↓ Drop here to add</p>
                )}
              </div>
            </div>

            <SortableContext
              items={day.activities.map((a) => a.id)}
              strategy={verticalListSortingStrategy}
            >
              <DroppableDay dayIndex={dayIndex} isOver={false}>
                {day.activities.map((activity, index) => (
                  <SortableCard
                    key={activity.id}
                    activity={activity}
                    dayIndex={dayIndex}
                    isSelected={selectedId === activity.id}
                    editingId={editingId}
                    editValue={editValue}
                    onCardClick={handleCardClick}
                    onStartEdit={startEdit}
                    onSaveEdit={saveEdit}
                    onRemove={removeActivity}
                    onEditValueChange={setEditValue}
                    onHover={onHoverActivity || (() => {})}
                    dayColor={DAY_COLORS[dayIndex % DAY_COLORS.length]}
                    index={index}
                  />
                ))}

                <button
                  onClick={() => addActivity(dayIndex)}
                  className="w-full py-6 rounded-2xl border-2 border-dashed border-border hover:border-primary/40 flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Plus className="w-5 h-5" />
                  <span className="text-sm font-medium">Add Activity</span>
                </button>
              </DroppableDay>
            </SortableContext>
          </div>
        ))}
      </div>
    </div>
  );
};

export default TravelItinerary;
