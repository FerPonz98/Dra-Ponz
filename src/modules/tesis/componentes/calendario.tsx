"use client";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/react/daygrid";
import esLocale from "@fullcalendar/react/locales/es";
import classicThemePlugin from "@fullcalendar/react/themes/classic";
import timeGridPlugin from "@fullcalendar/react/timegrid";
import "@fullcalendar/react/skeleton.css";
import "@fullcalendar/react/themes/classic/theme.css";
import "@fullcalendar/react/themes/classic/palette.css";
import type { EventoCalendario } from "@/modules/tesis/servicios/calendario";

/** Calendario mes/semana con actividades y fechas de cobro. */
export function Calendario({ eventos }: { eventos: EventoCalendario[] }) {
  return (
    <div className="rounded-lg border bg-background p-2 text-sm" data-testid="calendario">
      <FullCalendar
        plugins={[dayGridPlugin, timeGridPlugin, classicThemePlugin]}
        locale={esLocale}
        timeZone="America/La_Paz"
        initialView="dayGridMonth"
        headerToolbar={{ start: "prev,next today", center: "title", end: "dayGridMonth,timeGridWeek" }}
        height="auto"
        dayMaxEvents={4}
        events={eventos}
      />
    </div>
  );
}
