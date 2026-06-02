package app.quid.finance;

import android.Manifest;
import android.content.ContentUris;
import android.content.ContentValues;
import android.database.Cursor;
import android.net.Uri;
import android.provider.CalendarContract;
import androidx.annotation.Nullable;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.util.TimeZone;

@CapacitorPlugin(
    name = "QuidCalendar",
    permissions = {
        @Permission(
            alias = "calendar",
            strings = { Manifest.permission.READ_CALENDAR, Manifest.permission.WRITE_CALENDAR }
        )
    }
)
public class QuidCalendarPlugin extends Plugin {
    private static final String CALENDAR_PERMISSION = "calendar";

    @PluginMethod
    public void saveEvent(PluginCall call) {
        if (getPermissionState(CALENDAR_PERMISSION) != PermissionState.GRANTED) {
            requestPermissionForAlias(CALENDAR_PERMISSION, call, "saveEventPermissionCallback");
            return;
        }
        persistEvent(call);
    }

    @PermissionCallback
    private void saveEventPermissionCallback(PluginCall call) {
        if (getPermissionState(CALENDAR_PERMISSION) == PermissionState.GRANTED) {
            persistEvent(call);
        } else {
            call.reject("Quid necesita permiso para agregar eventos al calendario");
        }
    }

    @PluginMethod
    public void removeEvent(PluginCall call) {
        if (getPermissionState(CALENDAR_PERMISSION) != PermissionState.GRANTED) {
            requestPermissionForAlias(CALENDAR_PERMISSION, call, "removeEventPermissionCallback");
            return;
        }
        deleteEvent(call);
    }

    @PermissionCallback
    private void removeEventPermissionCallback(PluginCall call) {
        if (getPermissionState(CALENDAR_PERMISSION) == PermissionState.GRANTED) {
            deleteEvent(call);
        } else {
            call.reject("Quid necesita permiso para modificar el calendario");
        }
    }

    private void persistEvent(PluginCall call) {
        Long startAt = call.getLong("startAt");
        String title = call.getString("title");
        if (startAt == null || title == null || title.isBlank()) {
            call.reject("El evento necesita título y fecha");
            return;
        }

        Long eventId = parseEventId(call.getString("eventId"));
        ContentValues values = new ContentValues();
        values.put(CalendarContract.Events.TITLE, title);
        values.put(CalendarContract.Events.DESCRIPTION, call.getString("description", ""));
        values.put(CalendarContract.Events.EVENT_LOCATION, call.getString("location", ""));
        values.put(CalendarContract.Events.DTSTART, startAt);
        values.put(CalendarContract.Events.DTEND, call.getLong("endAt", startAt + 60 * 60 * 1000));
        values.put(CalendarContract.Events.EVENT_TIMEZONE, TimeZone.getDefault().getID());

        if (eventId == null) {
            Long calendarId = findWritableCalendarId();
            if (calendarId == null) {
                call.reject("No se encontró un calendario escribible en el teléfono");
                return;
            }
            values.put(CalendarContract.Events.CALENDAR_ID, calendarId);
            Uri created = getContext().getContentResolver().insert(CalendarContract.Events.CONTENT_URI, values);
            if (created == null) {
                call.reject("No se pudo crear el evento de calendario");
                return;
            }
            eventId = ContentUris.parseId(created);
        } else {
            Uri eventUri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId);
            getContext().getContentResolver().update(eventUri, values, null, null);
            getContext().getContentResolver().delete(
                CalendarContract.Reminders.CONTENT_URI,
                CalendarContract.Reminders.EVENT_ID + " = ?",
                new String[] { String.valueOf(eventId) }
            );
        }

        int reminderMinutes = call.getInt("reminderMinutes", 24 * 60);
        ContentValues reminder = new ContentValues();
        reminder.put(CalendarContract.Reminders.EVENT_ID, eventId);
        reminder.put(CalendarContract.Reminders.MINUTES, reminderMinutes);
        reminder.put(CalendarContract.Reminders.METHOD, CalendarContract.Reminders.METHOD_ALERT);
        getContext().getContentResolver().insert(CalendarContract.Reminders.CONTENT_URI, reminder);

        JSObject result = new JSObject();
        result.put("eventId", String.valueOf(eventId));
        call.resolve(result);
    }

    private void deleteEvent(PluginCall call) {
        Long eventId = parseEventId(call.getString("eventId"));
        if (eventId == null) {
            call.resolve();
            return;
        }

        Uri eventUri = ContentUris.withAppendedId(CalendarContract.Events.CONTENT_URI, eventId);
        getContext().getContentResolver().delete(eventUri, null, null);
        call.resolve();
    }

    @Nullable
    private Long findWritableCalendarId() {
        String[] projection = { CalendarContract.Calendars._ID };
        String selection =
            CalendarContract.Calendars.VISIBLE + " = 1 AND " +
            CalendarContract.Calendars.CALENDAR_ACCESS_LEVEL + " >= ?";
        String[] selectionArgs = {
            String.valueOf(CalendarContract.Calendars.CAL_ACCESS_CONTRIBUTOR)
        };
        String sortOrder = CalendarContract.Calendars.IS_PRIMARY + " DESC";

        try (Cursor cursor = getContext().getContentResolver().query(
            CalendarContract.Calendars.CONTENT_URI,
            projection,
            selection,
            selectionArgs,
            sortOrder
        )) {
            if (cursor != null && cursor.moveToFirst()) {
                return cursor.getLong(0);
            }
        }
        return null;
    }

    @Nullable
    private Long parseEventId(@Nullable String eventId) {
        if (eventId == null || eventId.isBlank()) return null;
        try {
            return Long.parseLong(eventId);
        } catch (NumberFormatException ignored) {
            return null;
        }
    }
}
