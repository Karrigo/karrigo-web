import Image from "next/image";
import { dishes } from "@/lib/fixtures";

/**
 * An endlessly scrolling row of dish and grocery photos — pure CSS, no JS. The list is
 * tripled so the `rail` keyframe can slide by exactly one copy's width
 * (33.3333%) and loop with no visible seam; three copies means the visible
 * viewport is never empty even on very wide screens.
 */
export function KitchenRail() {
  return (
    <section className="overflow-hidden">
      <div className="rail gap-md flex w-max">
        {[0, 1, 2].map((copy) => (
          <div key={copy} className="gap-md flex">
            {dishes.map((dish) => (
              <div key={`${copy}-${dish.image}`} className="w-[212px] shrink-0">
                <div className="bg-surface relative h-[138px] overflow-hidden rounded-panel-xs">
                  <Image
                    src={dish.image}
                    alt=""
                    fill
                    sizes="212px"
                    className="object-cover"
                  />
                </div>
              </div>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
