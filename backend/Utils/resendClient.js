import { Resend } from 'resend';
const resend = new Resend('re_QWhAMc3w_K8thTKp8WMhFiJnpHU862XnT');

export async function sendResenWelcomeEmail(to, name) {
    const { data, error } = await resend.emails.send({
    from:  'Unique Gamer <support@notify.uniquegamer.dpdns.org>',
    to: to,
    subject: 'Welcome to UniqueGamer!',
    html: `
    <div style="font-family:Arial, sans-serif;">
      <h2>Hey there ${name}, welcome aboard !</h2>
      <p>Thanks for signing up to Unique Gamer Test Application. Your account is now ready.</p>
      <p>If you have any questions, just hit reply — our team reads every message.</p>
      <p>— The Unique Gamer Crew</p>
      <hr>
      <small>This message was sent by Unique Gamer, notify.uniquegamer.dpdns.org</small>
    </div>
  `
  });
  
  if (error) {
    return console.log({ error });
  }

  console.log({ data });
}