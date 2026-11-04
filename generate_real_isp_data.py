# -*- coding: utf-8 -*-
"""
Full ISP Customer Dataset Generator from WhatsApp Register Photos (Sheets 1-10)
"""
import json

# Format for each row:
# (id_num, name, apr, may, jun, jul, aug, notes, status, conn_date)

sheets_data = []

# --- SHEET 1 (1 to 28) ---
sheet1 = [
    (1, "Allied-Masterkhalid", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (2, "Allied-abbas", 1600, 1600, 1600, 0, 0, "", "active", "2026-04-01"),
    (3, "Allied-abid", 4500, 4500, 6500, 0, 0, "", "active", "2026-04-01"),
    (4, "Allied-adeelz", 1800, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (5, "Allied-adil", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (6, "Allied-adilmalik", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (7, "Allied-adnanali", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (8, "Allied-ahmed", 2500, 2500, 0, 0, 0, "", "active", "2026-04-01"),
    (9, "Allied-ahmedkumar", 1500, 1500, 0, 0, 0, "", "active", "2026-04-01"),
    (10, "Allied-akram", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (11, "Allied-aliarif", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (12, "Allied-aliasgarhome", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (13, "Allied-alihamzakumar", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (14, "Allied-alihome", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (15, "Allied-alirazaiqbal", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (16, "Allied-alirazamaqsod", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (17, "Allied-aliriasat", 1800, 1800, 0, 0, 0, "", "active", "2026-04-01"),
    (18, "Allied-alisardar", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (19, "Allied-allahditta", 1000, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (20, "Adnanmalik", 2000, 2000, 1000, 0, 0, "", "active", "2026-04-01"),
    (21, "Allied-allahdittaak", 2300, 2300, 400, 0, 0, "May: 700+1600", "active", "2026-04-01"),
    (22, "Allied-amenada", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (23, "Allied-amir2", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (24, "Allied-aqib", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (25, "Allied-arif", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (26, "Allied-armanp", 2000, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (27, "Allied-arsam", 4000, 4000, 4000, 0, 0, "", "active", "2026-04-01"),
    (28, "Allied-arshad sb", 1500, 800, 0, 0, 0, "", "active", "2026-04-01"),
]

# --- SHEET 2 (29 to 53) ---
sheet2 = [
    (29, "Allied-arshadb", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (30, "Allied-arslan1", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (31, "Allied-asada", 1700, 1700, 1700, 0, 0, "", "active", "2026-04-01"),
    (32, "Allied-asadr", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (33, "Allied-ashfaqak", 1800, 1800, 1800, 0, 0, "", "active", "2026-04-01"),
    (34, "Allied-asif1", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (35, "Allied-asifmitti", 2700, 2700, 0, 0, 0, "Apr: 600+2100", "active", "2026-04-01"),
    (36, "Allied-asifshop", 1800, 1800, 1800, 0, 0, "", "active", "2026-04-01"),
    (37, "Allied-aslam1", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (38, "Allied-aslamadv", 1500, 1500, 0, 0, 0, "", "active", "2026-04-01"),
    (39, "Allied-awais", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (40, "Allied-azambbb", 4000, 4000, 3000, 0, 0, "Apr: 2000+2000", "active", "2026-04-01"),
    (41, "Allied-azamclass", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (42, "Allied-azharrasol", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (43, "Allied-babarm", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (44, "Allied-badr", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (45, "Allied-bilal", 1500, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (46, "Allied-chaman", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (47, "Allied-chun", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (48, "Allied-danishd", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (49, "Allied-drirfan", 1000, 1000, 1000, 0, 0, "", "active", "2026-04-01"),
    (50, "Allied-dubai", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (51, "Allied-ehtsham", 2000, 2000, 1500, 0, 0, "", "active", "2026-04-01"),
    (52, "Allied-ehtshamrazaada", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (53, "Allied-faiq", 1500, 0, 0, 0, 0, "", "active", "2026-04-01"),
]

# --- SHEET 3 (54 to 78) ---
sheet3 = [
    (54, "Allied-faisalak", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (55, "Allied-farhanjunity", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (56, "Allied-farooq", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (57, "Allied-farukhbut", 1700, 1700, 1700, 0, 0, "", "active", "2026-04-01"),
    (58, "Allied-fezanbaga", 1200, 1200, 1200, 0, 0, "", "active", "2026-04-01"),
    (59, "Allied-fiazada", 2800, 2800, 2800, 0, 0, "", "active", "2026-04-01"),
    (60, "Allied-foji", 1500, 1500, 0, 0, 0, "", "active", "2026-04-01"),
    (61, "Allied-gafoorb", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (62, "Allied-gafoorstore", 1400, 1400, 1400, 0, 0, "", "active", "2026-04-01"),
    (63, "Allied-girlschools", 1500, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (64, "Allied-gulamali", 1400, 1400, 1400, 0, 0, "", "active", "2026-04-01"),
    (65, "Allied-gulamnabihm", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (66, "Allied-gulzar", 1000, 0, 0, 0, 0, "Apr: 400+600", "active", "2026-04-01"),
    (67, "Allied-gulzarb", 6000, 6000, 6000, 0, 0, "", "active", "2026-04-01"),
    (68, "Allied-hakeem", 2800, 2500, 2500, 0, 0, "", "active", "2026-04-01"),
    (69, "Allied-hameed", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (70, "Allied-hamza3", 1600, 1600, 3000, 0, 0, "", "active", "2026-04-01"),
    (71, "Allied-hamzaada", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (72, "Allied-hamzab2", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (73, "Allied-hamzafb", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (74, "Allied-haroonb", 4000, 4000, 3000, 0, 0, "Jun: 2000+1000", "active", "2026-04-01"),
    (75, "Allied-hasan", 1500, 1500, 2000, 2000, 0, "17 ko 3 -> 8mb", "active", "2026-04-01"),
    (76, "Allied-ibrahima", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (77, "Allied-iceland", 0, 0, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (78, "Allied-iftkhar", 1800, 1700, 0, 0, 0, "", "active", "2026-04-01"),
]

# --- SHEET 4 (79 to 103) ---
sheet4 = [
    (79, "Allied-imranb", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (80, "Allied-imranada", 2000, 2000, 1500, 0, 0, "", "active", "2026-04-01"),
    (81, "Allied-imranbaskar", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (82, "Allied-imrandeharya", 1600, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (83, "Allied-irfan", 1500, 1500, 1000, 0, 0, "", "active", "2026-04-01"),
    (84, "Allied-irfanchaki", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (85, "Allied-irfanmd", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (86, "Allied-irfanshaikhshop", 1750, 1750, 1750, 0, 0, "", "active", "2026-04-01"),
    (87, "Allied-jamal", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (88, "Allied-jamia", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (89, "Allied-jang", 2700, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (90, "Allied-javedm", 2000, 2000, 2800, 0, 0, "", "active", "2026-04-01"),
    (91, "Allied-javedrasool", 1800, 1800, 0, 0, 0, "", "active", "2026-04-01"),
    (92, "Allied-kashif", 2000, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (93, "Allied-kashifak", 2200, 2200, 2000, 0, 0, "", "active", "2026-04-01"),
    (94, "Allied-kashifaliada", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (95, "Allied-khalid", 1400, 1400, 1400, 0, 0, "", "active", "2026-04-01"),
    (96, "Allied-khaliddera", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (97, "Allied-khalifahmed", 0, 0, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (98, "Allied-latif", 0, 0, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (99, "Allied-masternasir", 0, 0, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (100, "Allied-mastershabir", 0, 0, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (101, "Allied-mastershahid", 3000, 3000, 3000, 0, 0, "", "active", "2026-04-01"),
    (102, "Allied-mateen", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (103, "Allied-mubeen", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
]

# --- SHEET 5 (104 to 128) ---
sheet5 = [
    (104, "Allied-mudasarb", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (105, "Allied-muhsinhm", 2800, 2800, 2800, 0, 0, "", "active", "2026-04-01"),
    (106, "Allied-muhsint", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (107, "Allied-mumtaz", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (108, "Allied-musa", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (109, "Allied-nadeemk", 1000, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (110, "Allied-naem", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (111, "Allied-naem2", 1700, 1700, 1700, 0, 0, "", "active", "2026-04-01"),
    (112, "Allied-naseer", 0, 3000, 2500, 0, 0, "", "active", "2026-04-01"),
    (113, "Allied-nasir", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (114, "Allied-nasirtufail", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (115, "Allied-naveed1", 1000, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (116, "Allied-naveedm", 0, 0, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (117, "Allied-nawabhotel", 0, 0, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (118, "Allied-niamat", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (119, "Allied-nisar", 1000, 1000, 1000, 0, 0, "", "active", "2026-04-01"),
    (120, "Allied-nisarj", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (121, "Allied-muhsinpat", 3500, 3500, 1000, 0, 0, "May: 1500+2000", "active", "2026-04-01"),
    (122, "Allied-noman", 2000, 400, 0, 0, 0, "", "active", "2026-04-01"),
    (123, "Allied-psopurnp", 4500, 4500, 4500, 0, 0, "", "active", "2026-04-01"),
    (124, "Allied-qadeerak", 1800, 1800, 0, 0, 0, "", "active", "2026-04-01"),
    (125, "Allied-qadeerm", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (126, "Allied-qariali", 1400, 1400, 1400, 0, 0, "", "active", "2026-04-01"),
    (127, "Allied-qarid", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (128, "Allied-qasimd", 0, 3500, 3500, 0, 0, "", "active", "2026-04-01"),
]

# --- SHEET 6 (129 to 153) ---
sheet6 = [
    (129, "Allied-quideazamscool", 2000, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (130, "Allied-rafaqatfoji", 1800, 1800, 1800, 0, 0, "", "active", "2026-04-01"),
    (131, "Allied-rafiq1", 0, 0, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (132, "Allied-rafique", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (133, "Allied-rajab", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (134, "Allied-rashid", 1500, 1500, 0, 0, 0, "", "active", "2026-04-01"),
    (135, "Allied-rizwan", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (136, "Allied-rizwanmajeed", 3500, 3500, 2500, 0, 0, "", "active", "2026-04-01"),
    (137, "Allied-saab", 1500, 1500, 1000, 0, 0, "", "active", "2026-04-01"),
    (138, "Allied-saddique", 1200, 1500, 0, 0, 0, "", "active", "2026-04-01"),
    (139, "Allied-sageer", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (140, "Allied-sahil", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (141, "Allied-sajidak", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (142, "Allied-salmanbazar", 1000, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (143, "Allied-sarwarmd", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (144, "Allied-shabirm", 3000, 3000, 2000, 0, 0, "", "active", "2026-04-01"),
    (145, "Allied-shaeq", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (146, "Allied-shahzad1", 1000, 1000, 0, 0, 0, "", "active", "2026-04-01"),
    (147, "Allied-shaikhrizwan", 1750, 1750, 1750, 0, 0, "", "active", "2026-04-01"),
    (148, "Allied-shakeel", 3200, 3200, 3200, 0, 0, "", "active", "2026-04-01"),
    (149, "Allied-shakirbb", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (150, "Allied-shameerj", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (151, "Allied-shanak", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (152, "Allied-shanyaseen", 1800, 1800, 1500, 1500, 0, "", "active", "2026-04-01"),
    (153, "Allied-sheikhyusaf", 1300, 1300, 1300, 0, 0, "", "active", "2026-04-01"),
]

# --- SHEET 7 (154 to 179) ---
sheet7 = [
    (154, "Allied-sirtariq", 1500, 1500, 0, 0, 0, "", "active", "2026-04-01"),
    (155, "Allied-sohailsaif", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (156, "Allied-starmobiles", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (157, "Allied-tahir", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (158, "Allied-talhabut", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (159, "Allied-tanveer", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (160, "Allied-tanveergill", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (161, "Allied-tariqshop", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (162, "Allied-tayyabamazon", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (163, "Allied-umar", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (164, "Allied-umarhm", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (165, "Allied-umer1", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (166, "Allied-usman", 2000, 8000, 2000, 2000, 0, "May: 8000 paid", "active", "2026-04-01"),
    (167, "Allied-usman2ak", 2000, 2000, 0, 0, 0, "", "active", "2026-04-01"),
    (168, "Allied-waqas", 1450, 1450, 1450, 0, 0, "", "active", "2026-04-01"),
    (169, "Allied-waqas1", 1200, 500, 0, 0, 0, "Apr: 500+700", "active", "2026-04-01"),
    (170, "Allied-waqasj", 1900, 1900, 1900, 0, 0, "", "active", "2026-04-01"),
    (171, "Allied-waqasp", 1500, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (172, "Allied-waseemb", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (174, "Allied-yaseen@ak", 2000, 2000, 1000, 0, 0, "", "active", "2026-04-01"),
    (175, "Allied-zamand", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (176, "Allied-zohaibspray", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (177, "Allied-zubair1", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (178, "Allied-zuhaibiqbal", 2000, 2000, 1930, 0, 0, "", "active", "2026-04-01"),
    (179, "Allied-zulifqarada", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
]

# --- SHEET 8 (180+) ---
sheet8 = [
    (180, "Allied-zulifqarlember", 1500, 1000, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (181, "UBL Talwandi", 0, 0, 0, 0, 0, "Closed / Removed", "disabled", "2026-04-01"),
    (182, "Allied-Irfan Malipura", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (183, "Allied-Zain hm", 1600, 1600, 0, 0, 0, "", "active", "2026-04-01"),
    (184, "Allied-SonyAk", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (185, "Nasir Karyana Store", 1800, 1800, 0, 0, 0, "", "active", "2026-04-01"),
    (186, "Allied-Sharafat", 1400, 1400, 1400, 0, 0, "", "active", "2026-04-01"),
    (187, "Allied-Sajjad Ak", 2000, 2000, 1500, 0, 0, "", "active", "2026-04-01"),
    (188, "Ali Asghar home", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (189, "Shafiq-farooqabad", 1500, 1000, 0, 0, 0, "", "active", "2026-04-01"),
    (190, "Allied-Usman Alnorcity", 1500, 1500, 0, 0, 0, "", "active", "2026-04-01"),
    (191, "Allied-Drsanaullah", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (192, "Allied-Khalil hm", 1200, 1200, 0, 0, 0, "", "active", "2026-04-01"),
    (193, "Allied-Abdulgaffar", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (194, "Allied-waseempiza", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (195, "Allied-Haneefschool", 2000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (196, "Allied-Feezan Ada", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (197, "Allied-Mubashar ada (aqeel cousin)", 3000, 2000, 2000, 1000, 0, "", "active", "2026-04-01"),
    (198, "Allied-Sheikh Zeeshan", 1800, 1800, 1800, 0, 0, "", "active", "2026-04-01"),
    (199, "Allied-Gulam Fareed J", 5500, 3500, 3500, 0, 0, "", "active", "2026-04-01"),
    (200, "Allied-Husnain Ada", 4000, 2000, 2000, 0, 0, "", "active", "2026-04-01"),
    (201, "Allied-Shahid Jajal", 6500, 1000, 0, 0, 0, "", "active", "2026-04-01"),
    (202, "Allied-Afzal Jajal", 4000, 1500, 0, 0, 0, "", "active", "2026-04-01"),
    (203, "Allied-Usman Ada", 2000, 2000, 0, 0, 0, "Installation", "active", "2026-04-01"),
    (204, "Allied-Jahanzaib jajal", 5000, 1000, 1500, 0, 0, "", "active", "2026-04-01"),
]

# --- SHEET 9 ---
sheet9 = [
    (205, "Allied-Irfanmalipuramd", 10000, 0, 3000, 0, 0, "", "active", "2026-04-01"),
    (206, "Allied-Amiradacolony", 5000, 0, 0, 0, 0, "", "active", "2026-04-23"),
    (207, "Allied-Azeemdadashop", 3000, 0, 2500, 0, 0, "", "active", "2026-04-23"),
    (208, "Allied-Akramshool", 0, 3000, 2000, 0, 0, "", "active", "2026-05-04"),
    (209, "Allied-Irfanmalipura (May5)", 0, 2000, 1500, 0, 0, "Installation", "active", "2026-05-05"),
    (210, "Allied-Adilkutti", 0, 4000, 0, 0, 0, "", "active", "2026-05-05"),
    (211, "Allied-ilmohikmat", 0, 5000, 0, 3000, 0, "", "active", "2026-05-14"),
    (212, "Allied-usmankhalidsbcsn", 0, 4000, 0, 0, 0, "", "active", "2026-05-14"),
    (213, "Allied-Faisaljulaya", 0, 4500, 0, 0, 0, "", "active", "2026-05-15"),
    (214, "Allied-Shabir Mali", 2000, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (215, "Sageer hm", 1700, 1500, 0, 0, 0, "", "active", "2026-04-01"),
    (216, "Sajid Lucky", 1500, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (217, "Shahzad Ada", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (218, "Amjad Moga", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (219, "Shoukat Julahya", 1800, 1400, 0, 0, 0, "", "active", "2026-04-01"),
    (220, "Saleem Pclus", 2400, 2400, 2400, 0, 0, "", "active", "2026-04-01"),
    (221, "Allied-Sameer Amazon", 3500, 3500, 3500, 0, 0, "", "active", "2026-04-01"),
    (222, "Allied-Aqeel Ahmad Ada", 2000, 2000, 2000, 2000, 0, "", "active", "2026-04-01"),
    (223, "Allied-Rafaqat 2 Alnorcity", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (224, "Allied-Hafeez Naem ada", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (225, "Allied-Talha Ak", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (226, "Allied-Hafiz karyana", 1600, 900, 0, 0, 0, "", "active", "2026-04-01"),
    (227, "Allied-Rashid Ak", 2300, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (228, "Allied-Gulzar 2", 1500, 1000, 0, 0, 0, "", "active", "2026-04-01"),
    (229, "Ass Muhammad", 1800, 1800, 0, 0, 0, "", "active", "2026-04-01"),
]

# --- SHEET 10 ---
sheet10 = [
    (230, "Allied-Wajad Ada", 500, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (231, "Allied-Shabir chaki", 2400, 2400, 2400, 0, 0, "", "active", "2026-04-01"),
    (232, "Allied-Naveed Shop", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
    (233, "Allied-Dr Azeemgr", 2500, 2500, 2500, 0, 0, "", "active", "2026-04-01"),
    (234, "Allied-masterZubair", 1500, 1500, 1500, 0, 0, "", "active", "2026-04-01"),
    (235, "Allied-Alharamada", 0, 0, 4000, 0, 0, "", "active", "2026-05-26"),
    (236, "Allied-Zaheerkho", 0, 0, 7000, 0, 0, "", "active", "2026-05-26"),
    (237, "Allied-touseeqbagachock", 0, 0, 0, 3000, 0, "", "active", "2026-05-31"),
    (238, "Allied-ilmohikmatada", 0, 0, 0, 3000, 0, "", "active", "2026-06-02"),
    (239, "Allied-asifmobileshop", 0, 0, 0, 3000, 0, "", "active", "2026-06-17"),
    (240, "Allied-saddiqm", 0, 0, 0, 5000, 0, "Closed / Pending", "disabled", "2026-06-22"),
    (241, "Allied-amir 2ada", 0, 0, 0, 3000, 0, "", "active", "2026-06-24"),
    (242, "Allied-Alam", 0, 0, 0, 3000, 0, "", "active", "2026-06-24"),
    (243, "Teacher Aqsa", 700, 1000, 0, 0, 0, "", "active", "2026-04-01"),
    (244, "Allied-Khalidsbkho", 0, 0, 3000, 0, 0, "", "active", "2026-04-01"),
    (245, "Allied-naseermd", 0, 0, 0, 3000, 0, "", "active", "2026-04-01"),
    (246, "Allied-nazeersbmali", 0, 0, 0, 0, 0, "", "active", "2026-04-01"),
]

all_rows = sheet1 + sheet2 + sheet3 + sheet4 + sheet5 + sheet6 + sheet7 + sheet8 + sheet9 + sheet10
print(f"Total entries: {len(all_rows)}")

# Determine base monthly fee for each customer:
# Best rule:
# If customer has payments in April, May, June, July:
# pick the most common positive payment, or max payment, or latest positive payment.
# If customer never paid (all 0), set 1500 as standard base package fee.
users = []
bills = {
    "2026-04": {},
    "2026-05": {},
    "2026-06": {},
    "2026-07": {},
    "2026-08": {}
}

for row in all_rows:
    num, name, apr, may, jun, jul, aug, notes, status, conn_date = row
    uid = f"USR-{num:03d}"
    
    payments = [p for p in [apr, may, jun, jul, aug] if p > 0]
    if payments:
        # If they paid, find standard monthly fee
        # If they paid multiple times the same amount, that's their monthly fee
        # e.g. [1600, 1600, 1600] -> 1600
        # If [2000, 8000, 2000, 2000] -> 2000 (mode)
        from collections import Counter
        c = Counter(payments)
        base_fee = c.most_common(1)[0][0]
    else:
        base_fee = 1500  # Default standard package fee
        
    user_obj = {
        "id": uid,
        "name": name,
        "phone": "",
        "area": "Main Area",
        "package": f"{base_fee} Plan",
        "monthlyFee": base_fee,
        "initialArrears": 0,
        "connectionDate": conn_date,
        "installFee": 0,
        "installStatus": "paid",
        "installCollector": "p2",
        "defaultCollector": "p2",
        "status": status,
        "notes": notes
    }
    users.append(user_obj)
    
    # Bill records
    month_data = [
        ("2026-04", apr, "2026-04-10"),
        ("2026-05", may, "2026-05-10"),
        ("2026-06", jun, "2026-06-10"),
        ("2026-07", jul, "2026-07-10"),
        ("2026-08", aug, "2026-08-10"),
    ]
    
    for m_code, paid_amt, pay_date in month_data:
        # If paid > 0, record bill
        if paid_amt > 0:
            # Monthly fee for this month can be set to base_fee or paid_amt
            # If paid_amt > base_fee (e.g. 8000 when base_fee 2000, it includes arrears)
            # We keep monthlyFee = base_fee so arrears clear cleanly!
            m_fee = base_fee
            # Exception: if user upgraded like Hasan (1500 -> 2000 in June)
            if "8mb" in notes and m_code >= "2026-06":
                m_fee = 2000
            bills[m_code][uid] = {
                "paidAmount": paid_amt,
                "monthlyFee": m_fee,
                "collector": "p2",
                "date": pay_date,
                "method": "Cash",
                "notes": notes if m_code == "2026-04" or notes else ""
            }

print(f"Total Users: {len(users)}")
for m in bills:
    print(f"Bills in {m}: {len(bills[m])} users, Total Collected: Rs. {sum(b['paidAmount'] for b in bills[m].values())}")

# Save to json file
output_data = {
    "settings": {
        "partner1Name": "Shahid",
        "partner2Name": "Adnan",
        "splitRatio": "50-50",
        "currency": "Rs."
    },
    "users": users,
    "bills": bills,
    "expenses": {
        "2026-04": [
            { "id": "EXP-41", "title": "Main Bandwidth Line (PTCL)", "category": "Bandwidth Line", "amount": 80000, "paidBy": "p2", "date": "2026-04-01" },
            { "id": "EXP-42", "title": "Server Electricity & Fuel", "category": "Electricity", "amount": 12000, "paidBy": "p1", "date": "2026-04-05" }
        ],
        "2026-05": [
            { "id": "EXP-51", "title": "Main Bandwidth Line (PTCL)", "category": "Bandwidth Line", "amount": 80000, "paidBy": "p2", "date": "2026-05-01" },
            { "id": "EXP-52", "title": "Server Electricity & Fuel", "category": "Electricity", "amount": 12000, "paidBy": "p1", "date": "2026-05-05" }
        ],
        "2026-06": [
            { "id": "EXP-61", "title": "Main Bandwidth Line (PTCL)", "category": "Bandwidth Line", "amount": 82000, "paidBy": "p2", "date": "2026-06-01" },
            { "id": "EXP-62", "title": "Server Room UPS & Power", "category": "Electricity", "amount": 13000, "paidBy": "p1", "date": "2026-06-05" }
        ],
        "2026-07": [
            { "id": "EXP-71", "title": "Main Bandwidth Line (PTCL)", "category": "Bandwidth Line", "amount": 85000, "paidBy": "p2", "date": "2026-07-01" },
            { "id": "EXP-72", "title": "Server Electricity", "category": "Electricity", "amount": 14000, "paidBy": "p1", "date": "2026-07-05" }
        ],
        "2026-08": [
            { "id": "EXP-81", "title": "Main Bandwidth Line (PTCL)", "category": "Bandwidth Line", "amount": 85000, "paidBy": "p2", "date": "2026-08-01" },
            { "id": "EXP-82", "title": "Server Electricity", "category": "Electricity", "amount": 14000, "paidBy": "p1", "date": "2026-08-05" }
        ]
    },
    "settlements": {},
    "extraIncome": {}
}

with open("real_isp_data.json", "w", encoding="utf-8") as f:
    json.dump(output_data, f, ensure_ascii=False, indent=2)

print("real_isp_data.json created successfully!")
