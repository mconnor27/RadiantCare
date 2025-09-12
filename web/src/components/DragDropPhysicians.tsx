import React, { useState } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable'
import {
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

interface DragDropPhysiciansProps {
  children: React.ReactNode
  physicians: any[]
  onReorder: (fromIndex: number, toIndex: number) => void
}

interface SortableRowProps {
  id: string
  children: React.ReactNode
}

// Custom sensor that only activates from drag handles
class DragHandleSensor extends PointerSensor {
  static activators = [
    {
      eventName: 'onPointerDown' as const,
      handler: ({ nativeEvent }: any) => {
        // Only activate if the drag started from an element with data-drag-handle
        const target = nativeEvent.target as HTMLElement
        return target.closest('[data-drag-handle]') !== null
      },
    },
  ]
}

function SortableRow({ id, children }: SortableRowProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Translate.toString(transform),
    transition: isDragging ? 'none' : transition, // Disable transition during drag to prevent conflicts
    opacity: isDragging ? 0.8 : 1,
    zIndex: isDragging ? 1000 : 1, // Bring dragged item to front
  }

  // Clone children and add drag attributes to the entire row
  const rowWithDragAttributes = React.cloneElement(
    React.Children.only(children) as React.ReactElement,
    {
      ...attributes,
      ...listeners,
    }
  )

  return (
    <div ref={setNodeRef} style={style}>
      {rowWithDragAttributes}
    </div>
  )
}

export function DragDropPhysicians({ children, physicians, onReorder }: DragDropPhysiciansProps) {
  // Track the current order during drag for smooth reordering
  const [items, setItems] = useState(physicians)
  const [isDragging, setIsDragging] = useState(false)

  // Update items when physicians prop changes (but not during drag)
  React.useEffect(() => {
    if (!isDragging) {
      setItems(physicians)
    }
  }, [physicians, isDragging])

  const sensors = useSensors(
    useSensor(DragHandleSensor, {
      activationConstraint: {
        distance: 8, // Minimum drag distance
      },
    })
  )

  function handleDragStart() {
    setIsDragging(true)
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event

    if (over && active.id !== over.id) {
      setItems((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id)
        const newIndex = items.findIndex((item) => item.id === over.id)
        
        return arrayMove(items, oldIndex, newIndex)
      })
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    setIsDragging(false)

    if (active.id !== over?.id && over) {
      const oldIndex = physicians.findIndex((p) => p.id === active.id)
      const newIndex = physicians.findIndex((p) => p.id === over.id)
      onReorder(oldIndex, newIndex)
    }
  }

  const physicianIds = items.map(p => p.id)

  // Create a mapping of physician ID to child component
  const childrenArray = React.Children.toArray(children)
  const childrenMap = physicians.reduce((map, physician, index) => {
    if (childrenArray[index] && React.isValidElement(childrenArray[index])) {
      map[physician.id] = childrenArray[index] as React.ReactElement
    }
    return map
  }, {} as Record<string, React.ReactElement>)

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={physicianIds} strategy={verticalListSortingStrategy}>
        {items.map((physician) => {
          const child = childrenMap[physician.id]
          if (child) {
            return (
              <SortableRow key={physician.id} id={physician.id}>
                {child}
              </SortableRow>
            )
          }
          return null
        })}
      </SortableContext>
    </DndContext>
  )
}
