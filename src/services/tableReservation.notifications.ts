import { sendMail } from "@/services/email.service";
import { ETableReservationStatus } from "@/types/enums";

export type TableReservationEmailCtx = {
  placeName: string;
  visitDate: string;
  visitTime: string;
  partySize: number;
  firstName: string;
  reservationId: string;
};

export const notifyTableReservationReceived = async (
  to: string,
  ctx: TableReservationEmailCtx,
): Promise<void> => {
  const subject = `Заявку на бронювання отримано — ${ctx.placeName}`;
  const text = `Вітаємо, ${ctx.firstName}!\n\nЗаклад «${ctx.placeName}» отримав вашу заявку на ${ctx.partySize} осіб на ${ctx.visitDate} о ${ctx.visitTime}.\n\nМи зв’яжемося з вами після розгляду.`;
  await sendMail(to, subject, text);
};

export const notifyTableReservationStatusChange = async (
  to: string,
  status: ETableReservationStatus,
  ctx: TableReservationEmailCtx,
): Promise<void> => {
  let subject: string;
  let text: string;
  switch (status) {
    case ETableReservationStatus.confirmed:
      subject = `Бронювання підтверджено — ${ctx.placeName}`;
      text = `Вітаємо, ${ctx.firstName}!\n\nВаше бронювання в «${ctx.placeName}» підтверджено на ${ctx.visitDate} о ${ctx.visitTime}.`;
      break;
    case ETableReservationStatus.declined:
      subject = `Бронювання — ${ctx.placeName}`;
      text = `Вітаємо, ${ctx.firstName}.\n\nНа жаль, заклад «${ctx.placeName}» не може підтвердити бронювання на ${ctx.visitDate} о ${ctx.visitTime}.`;
      break;
    case ETableReservationStatus.rescheduled:
      subject = `Бронювання перенесено — ${ctx.placeName}`;
      text = `Вітаємо, ${ctx.firstName}!\n\nВаш візит у «${ctx.placeName}» перенесено на ${ctx.visitDate} о ${ctx.visitTime}`;
      break;
    default:
      return;
  }
  await sendMail(to, subject, text);
};
